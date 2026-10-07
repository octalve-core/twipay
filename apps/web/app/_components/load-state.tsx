export function LoadingCard(){return <div className="panel"><p>Loading securely…</p></div>}
export function ErrorCard({message}:{message:string}){return <div className="panel danger"><strong>Unable to load</strong><p>{message}</p></div>}
export function Empty({title,body}:{title:string;body:string}){return <div className="empty"><strong>{title}</strong><p>{body}</p></div>}
