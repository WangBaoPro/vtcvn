import { ReleaseInfo } from "./ReleaseInfo";
import { BanlistInfo } from "./BanlistInfo";
import { CardImage } from "./CardImage";
import { CardPrices } from "./CardPrices";
import { Format } from "./Format";
import { CardSet } from "./CardSet";
import { CardType } from "./CardType";

/**
 * Regular card. Also see {@link UnlinkedCard}.
 */
interface Card {
    readonly passcode: string;
    readonly name: string;
    readonly description: string;

    readonly type: CardType;
    readonly subType: string;

    readonly attribute: string | null;
    readonly atk: number | null;
    readonly def: number | null;
    readonly level: number | null;
    readonly pendulumScale: number | null;
    readonly linkRating: number | null;
    readonly linkMarkers: string[] | null;

    readonly betaName: string | null;
    readonly treatedAs: string | null;
    readonly archetype: string | null;

    readonly release: ReleaseInfo;
    readonly sets: CardSet[];
    readonly formats: Format[];
    readonly banlist: BanlistInfo;

    readonly image: CardImage | null;
    readonly prices: CardPrices;
    readonly views: number;
}

export { Card };
