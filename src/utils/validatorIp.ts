import { useT } from "@/hooks/use-t";

export const validatorIp = (ip: string) => {
  const ipArr = ip.split(".");
  const t = useT();

  return (
    (ipArr.length === 4 &&
    ipArr.every((el) => Number(el) >= 0 && Number(el) <= 255))
    || t('Ip not valid')
  );
};
