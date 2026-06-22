import { useContext } from 'react';
import { RoleContext } from '../context/role-context';

export function useRole() {
  return useContext(RoleContext);
}
