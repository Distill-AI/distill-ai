import { useContext } from 'react';
import { RoleContext } from '../context/RoleContext';

export function useRole() {
  return useContext(RoleContext);
}
