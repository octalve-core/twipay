export const Wait=()=> <div className="ops-panel"><p>Loading authorized data…</p></div>;
export const Fail=({code}:{code:string})=> <div className="ops-panel danger"><strong>Request blocked or unavailable</strong><p>{code}</p></div>;
