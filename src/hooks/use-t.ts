import {TRANSLATIONS} from "../constants/translations";

export const useT = () => (key : string) : string => {
    return  TRANSLATIONS[key] || key
}
