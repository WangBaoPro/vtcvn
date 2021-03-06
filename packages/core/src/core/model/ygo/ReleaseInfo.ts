import { Format } from "./Format";

interface ReleaseInfo {
    readonly [Format.TCG]: number | null;
    readonly [Format.OCG]: number | null;
}

export { ReleaseInfo };
