import { ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decryptSensitiveString, encryptSensitiveString } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import { AuditService } from './audit.service.js';

/** No financial transaction state, refunds, provider operations, or attachments are writable here. */
@Injectable()
export class CustomerSupportService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notifications: NotificationService) {}

  private readonly summary = (item: {reference:string;category:string;subjectCiphertext:string;status:string;createdAt:Date;updatedAt:Date}) => ({
    reference:item.reference,category:item.category,subject:decryptSensitiveString(item.subjectCiphertext,process.env['DATA_ENCRYPTION_KEY']!),status:item.status,createdAt:item.createdAt,updatedAt:item.updatedAt,
  });
  private decrypt(message: {id:string;authorType:string;bodyCiphertext:string;createdAt:Date}) {
    return { id:message.id, authorType:message.authorType, text:decryptSensitiveString(message.bodyCiphertext,process.env['DATA_ENCRYPTION_KEY']!), createdAt:message.createdAt };
  }
  /** Row locking the customer serializes daily creation caps, including simultaneous requests. */
  async create(input:{userId:string;category:string;subject:string;message:string;requestKey:string}) {
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${input.userId}::uuid FOR UPDATE`;
      const prior = await tx.supportCase.findUnique({where:{requestKey:input.requestKey}});
      if(prior) {
        if(prior.userId!==input.userId || prior.category!==input.category || decryptSensitiveString(prior.subjectCiphertext,process.env['DATA_ENCRYPTION_KEY']!)!==input.subject.trim()) throw new ConflictException({code:'SUPPORT_REQUEST_KEY_CONFLICT'});
        const original=await tx.supportMessage.findUnique({where:{requestKey:input.requestKey}});
        if(!original||decryptSensitiveString(original.bodyCiphertext,process.env['DATA_ENCRYPTION_KEY']!)!==input.message.trim())throw new ConflictException({code:'SUPPORT_REQUEST_KEY_CONFLICT'});
        return this.summary(prior);
      }
      const since = new Date(Date.now()-24*60*60*1000);
      if(await tx.supportCase.count({where:{userId:input.userId,createdAt:{gte:since}}})>=5)
        throw new HttpException({code:'SUPPORT_DAILY_LIMIT'},429);
      const item=await tx.supportCase.create({data:{reference:`sup_${randomUUID()}`,userId:input.userId,category:input.category,subjectCiphertext:encryptSensitiveString(input.subject.trim(),process.env['DATA_ENCRYPTION_KEY']!),requestKey:input.requestKey}});
      await tx.supportMessage.create({data:{caseId:item.id,authorUserId:input.userId,authorType:'CUSTOMER',bodyCiphertext:encryptSensitiveString(input.message.trim(),process.env['DATA_ENCRYPTION_KEY']!),requestKey:input.requestKey}});
      return this.summary(item);
    },{isolationLevel:'Serializable'});
  }
  async listForCustomer(userId:string) {
    const rows=await this.prisma.supportCase.findMany({where:{userId},orderBy:{updatedAt:'desc'},take:50});
    return rows.map(this.summary);
  }
  async customerDetail(userId:string,reference:string) {
    const item=await this.prisma.supportCase.findFirst({where:{reference,userId},include:{messages:{orderBy:{createdAt:'asc'},take:100}}});
    if(!item)throw new NotFoundException({code:'SUPPORT_CASE_NOT_FOUND'});
    return {...this.summary(item),messages:item.messages.map(m=>this.decrypt(m))};
  }
  async customerReply(input:{userId:string;reference:string;message:string;requestKey:string}) {
    return this.prisma.$transaction(async tx=>{
      const lock=await tx.$queryRaw<Array<{id:string}>>`SELECT "id" FROM "support_cases" WHERE "reference"=${input.reference} AND "userId"=${input.userId}::uuid FOR UPDATE`;
      if(!lock[0])throw new NotFoundException({code:'SUPPORT_CASE_NOT_FOUND'});
      const item=await tx.supportCase.findFirstOrThrow({where:{reference:input.reference,userId:input.userId}});
      const prior=await tx.supportMessage.findUnique({where:{requestKey:input.requestKey}});
      if(prior){if(prior.caseId!==item.id||prior.authorUserId!==input.userId||prior.authorType!=='CUSTOMER'||decryptSensitiveString(prior.bodyCiphertext,process.env['DATA_ENCRYPTION_KEY']!)!==input.message.trim())throw new ConflictException({code:'SUPPORT_REQUEST_KEY_CONFLICT'});return this.summary(item);}
      if(item.status==='CLOSED')throw new ConflictException({code:'SUPPORT_CASE_CLOSED'});
      if(await tx.supportMessage.count({where:{caseId:item.id}})>=100)throw new ConflictException({code:'SUPPORT_CONVERSATION_LIMIT'});
      await tx.supportMessage.create({data:{caseId:item.id,authorUserId:input.userId,authorType:'CUSTOMER',requestKey:input.requestKey,bodyCiphertext:encryptSensitiveString(input.message.trim(),process.env['DATA_ENCRYPTION_KEY']!)}});
      const updated=await tx.supportCase.update({where:{id:item.id},data:{status:'WAITING_SUPPORT'}});
      await this.audit.recordWithTx(tx,{actorUserId:input.userId,action:'SUPPORT_CUSTOMER_REPLY',targetType:'support_case',targetId:item.id,afterState:{status:updated.status}});
      return this.summary(updated);
    },{isolationLevel:'Serializable'});
  }
  async queue() {
    const rows=await this.prisma.supportCase.findMany({where:{status:{not:'CLOSED'}},orderBy:{updatedAt:'asc'},take:100});
    return rows.map(this.summary);
  }
  async staffDetail(reference:string) {
    const item=await this.prisma.supportCase.findUnique({where:{reference},include:{messages:{orderBy:{createdAt:'asc'},take:100}}});
    if(!item)throw new NotFoundException({code:'SUPPORT_CASE_NOT_FOUND'});
    return {...this.summary(item),messages:item.messages.map(m=>this.decrypt(m))};
  }
  async staffReply(input:{staffUserId:string;reference:string;message:string;requestKey:string;requestId?:string}) {
    return this.prisma.$transaction(async tx=>{
      const lock=await tx.$queryRaw<Array<{id:string}>>`SELECT "id" FROM "support_cases" WHERE "reference"=${input.reference} FOR UPDATE`;
      if(!lock[0])throw new NotFoundException({code:'SUPPORT_CASE_NOT_FOUND'});
      const item=await tx.supportCase.findUniqueOrThrow({where:{reference:input.reference}});
      const prior=await tx.supportMessage.findUnique({where:{requestKey:input.requestKey}});
      if(prior){if(prior.caseId!==item.id||prior.authorUserId!==input.staffUserId||prior.authorType!=='STAFF'||decryptSensitiveString(prior.bodyCiphertext,process.env['DATA_ENCRYPTION_KEY']!)!==input.message.trim())throw new ConflictException({code:'SUPPORT_REQUEST_KEY_CONFLICT'});return this.summary(item);}
      if(item.status==='CLOSED')throw new ConflictException({code:'SUPPORT_CASE_CLOSED'});
      if(await tx.supportMessage.count({where:{caseId:item.id}})>=100)throw new ConflictException({code:'SUPPORT_CONVERSATION_LIMIT'});
      await tx.supportMessage.create({data:{caseId:item.id,authorUserId:input.staffUserId,authorType:'STAFF',requestKey:input.requestKey,bodyCiphertext:encryptSensitiveString(input.message.trim(),process.env['DATA_ENCRYPTION_KEY']!)}});
      const updated=await tx.supportCase.update({where:{id:item.id},data:{status:'WAITING_CUSTOMER'}});
      await this.audit.recordWithTx(tx,{actorUserId:input.staffUserId,action:'SUPPORT_REPLY',targetType:'support_case',targetId:item.id,requestId:input.requestId,afterState:{status:updated.status}});
      const customer=await tx.user.findUnique({where:{id:item.userId},select:{email:true,emailVerifiedAt:true}});
      if(customer?.emailVerifiedAt){
        await this.notifications.enqueueWithTx(tx,{userId:item.userId,channel:'EMAIL',templateCode:'SUPPORT_REPLY',destination:customer.email,subject:'Update on your TwiPay support request',text:'You have a new reply to your support request. Sign in to TwiPay to view it. Never share your password or transaction PIN.',idempotencyKey:`support-reply:${input.requestKey}`});
      }
      return this.summary(updated);
    },{isolationLevel:'Serializable'});
  }
  async staffClose(input:{staffUserId:string;reference:string;requestId?:string}) {
    return this.prisma.$transaction(async tx=>{
      const lock=await tx.$queryRaw<Array<{id:string}>>`SELECT "id" FROM "support_cases" WHERE "reference"=${input.reference} FOR UPDATE`;
      if(!lock[0])throw new NotFoundException({code:'SUPPORT_CASE_NOT_FOUND'});
      const item=await tx.supportCase.findUniqueOrThrow({where:{reference:input.reference}});
      if(item.status==='CLOSED')return this.summary(item);
      const updated=await tx.supportCase.update({where:{id:item.id},data:{status:'CLOSED'}});
      await this.audit.recordWithTx(tx,{actorUserId:input.staffUserId,action:'SUPPORT_CASE_CLOSED',targetType:'support_case',targetId:item.id,requestId:input.requestId,beforeState:{status:item.status},afterState:{status:'CLOSED'}});
      return this.summary(updated);
    },{isolationLevel:'Serializable'});
  }
}
