import { createHash } from 'node:crypto';
import { desc,eq } from 'drizzle-orm';
import { pqcKeyHistory } from '../db/schema';

/** Server audit hash chain only: NOT independently anchored or tamper-proof against DB administrators. */
export function eventDigest(userId:string,keyId:string,type:string,fingerprint:string,previous:string){
  return createHash('sha256').update(JSON.stringify(['PQFILE:KEY-EVENT:V1',userId,keyId,type,fingerprint,previous])).digest('hex');
}
export async function appendKeyEvent(tx:any,userId:string,keyId:string,type:string,fingerprint:string){
  // The caller must serialize writes per account in its transaction if concurrency is possible.
  const [previous]=await tx.select().from(pqcKeyHistory).where(eq(pqcKeyHistory.userId,userId))
    .orderBy(desc(pqcKeyHistory.sequence)).limit(1);
  const prevHash=previous?.entryHash||'0'.repeat(64);
  const entryHash=eventDigest(userId,keyId,type,fingerprint,prevHash);
  await tx.insert(pqcKeyHistory).values({userId,keyId,eventType:type,fingerprint,prevHash,entryHash});
}
