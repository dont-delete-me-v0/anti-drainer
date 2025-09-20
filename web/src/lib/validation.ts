export const validatePrivateKey = (pk: string): boolean => {
  return pk.startsWith("0x") && pk.length === 66;
};

export const validateAddress = (addr: string): boolean => {
  return addr.startsWith("0x") && addr.length === 42;
};
