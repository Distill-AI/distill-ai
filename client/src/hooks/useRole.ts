import { useContext } from 'react';
import { RoleContext } from '../context/roleContext';

export function useRole() {
  return useContext(RoleContext);
}
