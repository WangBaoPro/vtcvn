import { injectable } from "inversify";
import { UnlinkedCard } from "../../model/ygo/intermediate/UnlinkedCard";
import { CardSet } from "../../model/ygo/CardSet";
import { CardType } from "../../model/ygo/CardType";
import { Card } from "../../model/ygo/Card";
import { CardSetAppearance } from "../../model/ygo/intermediate/CardSetAppearance";
import { getLogger } from "../../../logger";

/**
 * @private
 */
@injectable()
class CardLinkingService {
    private static readonly logger = getLogger(CardLinkingService);

    /**
     * Links an unlinked card.
     *
     * @param unlinkedCard Unlinked card.
     * @param setMap Set data to link against.
     * @param typeMap Type data to link against.
     * @return linked card.
     */
    public linkCard(
        unlinkedCard: UnlinkedCard,
        setMap: Map<string, CardSet>,
        typeMap: Map<string, CardType>
    ): Card {
        return {
            passcode: unlinkedCard.passcode,
            name: unlinkedCard.name,
            description: unlinkedCard.description,

            type: this.linkType(unlinkedCard.type, typeMap),
            subType: unlinkedCard.subType,
            attribute: unlinkedCard.attribute,
            atk: unlinkedCard.atk,
            def: unlinkedCard.def,
            level: unlinkedCard.level,
            pendulumScale: unlinkedCard.pendulumScale,
            linkRating: unlinkedCard.linkRating,
            linkMarkers: unlinkedCard.linkMarkers,

            sets: this.linkSets(unlinkedCard.sets, setMap),
            image: unlinkedCard.image,
            prices: unlinkedCard.prices,
            betaName: unlinkedCard.betaName,
            treatedAs: unlinkedCard.treatedAs,
            archetype: unlinkedCard.archetype,

            formats: unlinkedCard.formats,
            release: unlinkedCard.release,
            banlist: unlinkedCard.banlist,

            views: unlinkedCard.views,
        };
    }

    private linkSets(
        setAppearances: CardSetAppearance[],
        setCache: Map<string, CardSet>
    ): CardSet[] {
        return setAppearances
            .map((setAppearance) => {
                if (!setCache.has(setAppearance.name)) {
                    CardLinkingService.logger.warn(
                        `Could not find set '${setAppearance.name}'.`
                    );
                    return null;
                }
                const matchingSet = setCache.get(setAppearance.name)!;
                CardLinkingService.logger.trace(
                    `Matched set ${setAppearance.name} to ${matchingSet.name}.`
                );
                return matchingSet;
            })
            .filter((set) => set != null) as CardSet[];
    }

    private linkType(
        typeName: string,
        typeCache: Map<string, CardType>
    ): CardType {
        if (!typeCache.has(typeName)) {
            throw new TypeError(`Could not find type '${typeName}'.`);
        }
        const matchingType = typeCache.get(typeName)!;
        CardLinkingService.logger.trace(
            `Matched type ${typeName} to ${matchingType.name}.`
        );
        return matchingType;
    }
}

export { CardLinkingService };
