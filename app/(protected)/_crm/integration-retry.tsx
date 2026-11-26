"use client";
import { useActionState } from "react";
import { retryIntake } from "./integration-actions";
export function IntegrationRetry({id}:{id:string}){
  const [state,action,pending]=useActionState(retryIntake,{message:''});
  return <form action={action}><input type="hidden" name="id" value={id}/><button disabled={pending}>{pending?'Processing…':'Retry intake'}</button><p role="status">{state.message}</p></form>;
}
