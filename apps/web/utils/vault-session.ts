import type {VaultKeys} from '@pqfile/crypto-core';
// Memory only: never persist unlocked secret keys to LocalStorage or Nuxt SSR state.
let unlocked:VaultKeys|null=null;
export const getUnlockedVault=()=>unlocked;
export const setUnlockedVault=(v:VaultKeys|null)=>{unlocked=v;};
