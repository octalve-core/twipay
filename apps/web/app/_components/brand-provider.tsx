"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {API_BASE} from '../_lib/api';

type Brand={productName:string;legalName:string;domain:string;supportEmail:string;logoUrl:string|null;primaryColor:string;accentColor:string};
type PublicFeature={enabled:boolean;config:unknown};
type ProductContextValue={brand:Brand;features:Record<string,PublicFeature>};
const fallback:Brand={productName:'TwiPay',legalName:'Octalve Ltd',domain:'twipay.co',supportEmail:'support@twipay.co',logoUrl:null,primaryColor:'#5B2A86',accentColor:'#C59A35'};
const ProductContext=createContext<ProductContextValue>({brand:fallback,features:{}});

export function BrandProvider({children}:{children:React.ReactNode}){
  const[value,setValue]=useState<ProductContextValue>({brand:fallback,features:{}});
  useEffect(()=>{
    if(!API_BASE)return;
    fetch(`${API_BASE}/v1/product/config`,{cache:'no-store'})
      .then(async r=>r.ok?await r.json():null)
      .then(v=>{
        if(!v?.brand)return;
        const brand={...fallback,...v.brand};
        setValue({brand,features:v.features??{}});
        document.documentElement.style.setProperty('--brand',brand.primaryColor);
        document.documentElement.style.setProperty('--accent',brand.accentColor);
        document.title=brand.productName;
      })
      .catch(()=>{});
  },[]);
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export const useBrand=()=>useContext(ProductContext).brand;
export const useFeature=(key:string,defaultEnabled=false)=>useContext(ProductContext).features[key]?.enabled??defaultEnabled;
export function BrandName(){return <>{useBrand().productName}</>}
