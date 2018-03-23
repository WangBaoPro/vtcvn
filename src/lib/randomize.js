import Deck from "./classes/deck";
import { DECKPARTS } from "./data/deck";
import { arrUniq, randShuffle, randNumber, arrFlattenDeep } from "lightdash";

const REGEX_NAME_DELIMITER = /\s?[,;:\- ]?\s/;

/**
 * Soft limits
 * If the deck currently has less, than MAX_${type}, add more
 * A max of 5 could lead to 7 cards that way
 */
const MAX_SPELLS = 18;
const MAX_TRAPS = 6;

const archetypePoolFactory = (shuffledPairs, archetypes, randChance) => {
    const namesMain = archetypes.map(archetype => archetype[0]);
    const namesRequired = arrUniq(
        arrFlattenDeep(archetypes.map(archetype => archetype[1]))
    );
    const namesOptional = arrUniq(
        arrFlattenDeep(archetypes.map(archetype => archetype[2]))
    );
    const requiredPool = shuffledPairs.filter(card => {
        const name = card[1].name;

        /**
         * Full matches always get added, archetype matches only sometimes
         */
        if (namesRequired.includes(name)) {
            return true;
        } else if (
            namesRequired.some(archetype =>
                name.toLowerCase().includes(archetype.toLowerCase())
            )
        ) {
            return Math.random() < 0.5;
        }

        return false;
    });
    const mainPool = shuffledPairs.filter(card => {
        const name = card[1].name;

        if (requiredPool.includes(card)) {
            return false;
        }

        /**
         * Full matches always get added, archetype matches only sometimes
         */
        if (
            namesMain.some(archetype =>
                name.toLowerCase().includes(archetype.toLowerCase())
            )
        ) {
            return true;
        } else if (namesOptional.some(archetype => name.includes(archetype))) {
            return Math.random() < 0.5;
        }

        return Math.random() < randChance;
    });

    return {
        main: mainPool,
        required: requiredPool
    };
};

const getRandomAmount = (preferPlayset = true) => {
    const seed = Math.random();

    if (preferPlayset) {
        if (seed > 0.7) return 1;
        else if (seed > 0.6) return 2;
        return 3;
    }
    if (seed > 0.25) return 1;
    else if (seed > 0.1) return 2;
    return 3;
};

const addCardRandomAmount = (arr, card, limit, preferPlayset = true) => {
    const cardAmountMaxFromBanlist = card[1].limit[0];
    let cardAmountRandom = getRandomAmount(preferPlayset);

    if (cardAmountRandom > cardAmountMaxFromBanlist) {
        cardAmountRandom = cardAmountMaxFromBanlist;
    }
    if (arr.length + cardAmountRandom > limit) {
        cardAmountRandom = limit - arr.length;
    }

    if (cardAmountRandom > 0) {
        return [...arr, ...new Array(cardAmountRandom).fill(card[0])];
    }

    return arr;
};

const getRandomName = cardNameList => {
    const words = cardNameList
        .join(" ")
        .split(REGEX_NAME_DELIMITER)
        .filter(word => word[0].toUpperCase() === word[0]); // Only use Capitalized words to avoid 'the' and 'of'

    return randShuffle(arrUniq(words))
        .slice(0, randNumber(2, 4))
        .join(" ")
        .trim();
};

const randomizeDeck = (cardDb, getPools) => {
    const deckpartHasSpace = deckpartIndex =>
        result[deckpartIndex].length <
        (deckpartIndex === 0 ? DECKPARTS[0].min : DECKPARTS[deckpartIndex].max);

    const deckpartCanAdd = (card, deckpartIndex) =>
        deckpartHasSpace(deckpartIndex) &&
        DECKPARTS[deckpartIndex].check(card[1]);

    const pools = getPools(cardDb.pairsArrUniq);

    pools.main = randShuffle(pools.main);
    pools.required = randShuffle(pools.required);

    console.log(pools);

    //console.log({ pool });
    const result = [[], [], []];
    const resultCardNames = [];
    let mainDeckCountSpells = 0;
    let mainDeckCountTraps = 0;
    let i = 0;

    while (
        (deckpartHasSpace(0) || deckpartHasSpace(1) || deckpartHasSpace(1)) &&
        i < pools.main.length
    ) {
        const card = pools.main[i];

        if (deckpartCanAdd(card, 0)) {
            const isSpell = card[1].type === "Spell Card";
            const isTrap = card[1].type === "Trap Card";

            if (
                (!isSpell || mainDeckCountSpells < MAX_SPELLS) &&
                (!isTrap || mainDeckCountTraps < MAX_TRAPS)
            ) {
                const prevLength = result[0].length;

                result[0] = addCardRandomAmount(
                    result[0],
                    card,
                    DECKPARTS[0].min
                );

                const cardsAdded = result[0].length - prevLength;

                if (cardsAdded === 3) {
                    resultCardNames.push(card[1].name);
                }
                if (isSpell) {
                    mainDeckCountSpells += cardsAdded;
                } else if (isTrap) {
                    mainDeckCountTraps += cardsAdded;
                }
            }
        } else if (deckpartCanAdd(card, 1)) {
            result[1] = addCardRandomAmount(
                result[1],
                card,
                DECKPARTS[1].max,
                false
            );
        } else if (deckpartCanAdd(card, 2)) {
            result[2] = addCardRandomAmount(
                result[2],
                card,
                DECKPARTS[2].max,
                false
            );
        }

        i++;
    }

    return new Deck(result, getRandomName(resultCardNames)).sort(cardDb);
};

export { archetypePoolFactory, randomizeDeck, getRandomName, getRandomAmount };