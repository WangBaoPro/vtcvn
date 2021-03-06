import { inject, injectable } from "inversify";
import { Deck } from "../../model/ygo/Deck";
import { TYPES } from "../../../types";
import { CardDatabase, FindCardBy } from "../CardDatabase";
import { Card } from "../../model/ygo/Card";
import { isEqual } from "lodash";
import { DeckService } from "./DeckService";
import { DEFAULT_DECK_PART_ARR } from "../../model/ygo/DeckPart";
import { fromByteArray, toByteArray } from "base64-js";
import { deflateRaw, inflate, inflateRaw } from "pako";

/**
 * @public
 */
@injectable()
class DeckUriEncodingService {
    // A 32 bit integer is able to store all 8 digit passcodes
    // Note that currently we assume only little endian systems are used.
    private static readonly BLOCK_BYTE_SIZE = Uint32Array.BYTES_PER_ELEMENT;
    private static readonly LIMIT =
        2 ** (DeckUriEncodingService.BLOCK_BYTE_SIZE * 8); // Max number that can be stored in BLOCK_BYTE_SIZE bytes.

    private static readonly URL_QUERY_PARAM_VALUE_DELIMITER_BLOCK: Uint8Array = new Uint8Array(
        DeckUriEncodingService.BLOCK_BYTE_SIZE
    ).fill(0);
    private static readonly URL_QUERY_PARAM_VALUE_LITTLE_ENDIAN = true;

    private static readonly YDKE_URI_PROTOCOL = "ydke://";
    private static readonly YDKE_DELIMITER = "!";

    private readonly cardDatabase: CardDatabase;
    private readonly deckService: DeckService;
    private readonly textEncoder: TextEncoder;
    private readonly textDecoder: TextDecoder;

    constructor(
        @inject(TYPES.CardDatabase)
        cardDatabase: CardDatabase,
        @inject(TYPES.DeckService)
        deckService: DeckService
    ) {
        this.deckService = deckService;
        this.cardDatabase = cardDatabase;
        this.textEncoder = new TextEncoder();
        this.textDecoder = new TextDecoder();
    }

    /**
     * Encodes a deck to a `ydke` URI.
     * Note that the deck name is not stored in the URI.
     *
     * @see #fromUri
     *
     * @param deck Deck to encode.
     * @return `ydke` URI.
     */
    public toUri(deck: Deck): string {
        const encodedDeckParts: string[] = [];
        for (const deckPart of DEFAULT_DECK_PART_ARR) {
            const encodedCards = [];
            for (const card of deck.parts.get(deckPart)!) {
                encodedCards.push(...this.encodeCardBlock(card));
            }
            encodedDeckParts.push(
                this.encodeBase64String(Uint8Array.from(encodedCards), false)
            );
        }
        return (
            DeckUriEncodingService.YDKE_URI_PROTOCOL +
            encodedDeckParts.join(DeckUriEncodingService.YDKE_DELIMITER) +
            DeckUriEncodingService.YDKE_DELIMITER
        );
    }

    /**
     * Decodes a deck from a `ydke` URI.
     *
     * @see https://github.com/edo9300/edopro/issues/171
     * @see https://github.com/AlphaKretin/bastion-bot/commit/0349cdced8ad2d2de5c4758ea7312197505e94ef
     *
     * @param uri `ydke` URI to decode
     * @return Deck.
     */
    public fromUri(uri: string): Deck {
        const uriParts = uri
            .slice(DeckUriEncodingService.YDKE_URI_PROTOCOL.length)
            .split(DeckUriEncodingService.YDKE_DELIMITER);
        uriParts.pop(); // uriParts is always one longer than there are deck parts due to trailing delimiter.

        if (uriParts.length !== DEFAULT_DECK_PART_ARR.length) {
            throw new Error(
                `Expected URI to have ${DEFAULT_DECK_PART_ARR.length} delimiters but found ${uriParts.length}.`
            );
        }

        const deck = this.deckService.createEmptyDeck();
        for (
            let deckPartIndex = 0;
            deckPartIndex < uriParts.length;
            deckPartIndex++
        ) {
            const deckPartCards = deck.parts.get(
                DEFAULT_DECK_PART_ARR[deckPartIndex]
            )!;
            const decodedDeckPartCards = this.decode64String(
                uriParts[deckPartIndex],
                false
            );
            for (
                let blockStart = 0;
                blockStart < decodedDeckPartCards.length;
                blockStart += DeckUriEncodingService.BLOCK_BYTE_SIZE
            ) {
                const block = decodedDeckPartCards.slice(
                    blockStart,
                    blockStart + DeckUriEncodingService.BLOCK_BYTE_SIZE
                );
                deckPartCards.push(this.decodeCardBlock(block));
            }
        }
        return deck;
    }

    /**
     * Encodes a deck to a URI query parameter value safe string.
     *
     * Encoding steps:
     * <ol>
     *     <li>Create byte array of deck name and cards (see below)</li>
     *     <li>Deflate the byte array to producer shorter results</li>
     *     <li>Base64 encode the value with an URI safe alphabet to allow usage in URI query parameter values</li>
     * </ol>
     *
     * Byte Array structure:
     * Blocks of {@link #BLOCK_BYTE_SIZE} represent a single card passcode number,
     * with a special value {@link #URL_QUERY_PARAM_VALUE_DELIMITER_BLOCK} being used to separate deck-parts.
     * After the last card of the last deck part and the delimiter,
     * the UTF-8 code-points of the deck name follow, if one is set.
     *
     * @param deck Deck to encode.
     * @return Value that can be decoded to yield the same deck.
     */
    public toUrlQueryParamValue(deck: Deck): string {
        const result: number[] = []; // Array of unsigned 8 bit numbers, using this over Uint8Array for convenience.

        for (const deckPart of DEFAULT_DECK_PART_ARR) {
            for (const card of deck.parts.get(deckPart)!) {
                result.push(...this.encodeCardBlock(card));
            }
            result.push(
                ...DeckUriEncodingService.URL_QUERY_PARAM_VALUE_DELIMITER_BLOCK
            );
        }
        if (deck.name != null && deck.name !== "") {
            result.push(...this.textEncoder.encode(deck.name));
        }

        const deflated = deflateRaw(Uint8Array.from(result));
        return this.encodeBase64String(deflated, true);
    }

    /**
     * Creates a deck from a query parameter value created by {@link toUrlQueryParamValue}.
     *
     * @param queryParamValue query parameter value.
     * @return Deck.
     */
    public fromUrlQueryParamValue(queryParamValue: string): Deck {
        const deck = this.deckService.createEmptyDeck();

        const decoded = this.decode64String(queryParamValue, true);
        const inflated = inflateRaw(decoded);

        let deckPartIndex = 0;
        let metaDataStart: null | number = null;
        for (
            let blockStart = 0;
            blockStart < inflated.length;
            blockStart += DeckUriEncodingService.BLOCK_BYTE_SIZE
        ) {
            const blockEnd =
                blockStart + DeckUriEncodingService.BLOCK_BYTE_SIZE;
            const block = inflated.slice(blockStart, blockEnd);

            if (
                isEqual(
                    block,
                    DeckUriEncodingService.URL_QUERY_PARAM_VALUE_DELIMITER_BLOCK
                )
            ) {
                // After the last deck part, meta data starts
                if (deckPartIndex === DEFAULT_DECK_PART_ARR.length - 1) {
                    metaDataStart = blockEnd;
                    break;
                }
                deckPartIndex++;
            } else {
                const deckPartCards = deck.parts.get(
                    DEFAULT_DECK_PART_ARR[deckPartIndex]
                )!;
                deckPartCards.push(this.decodeCardBlock(block));
            }
        }
        if (metaDataStart != null && metaDataStart < inflated.length) {
            deck.name = this.textDecoder.decode(
                inflated.subarray(metaDataStart)
            );
        }
        return deck;
    }

    /**
     * @deprecated
     */
    public fromLegacyUrlQueryParamValue(
        val: string,
        base64Decoder: (val: string) => string
    ): Deck {
        const deck = this.deckService.createEmptyDeck();
        const uncompressedValue = inflate(base64Decoder(val), {
            to: "string",
        });

        const DELIMITERS = {
            deckPart: "|",
            passcode: ";",
            cardAmount: "*",
        };

        uncompressedValue
            .split(DELIMITERS.deckPart)
            .forEach((deckPartList: string, index) => {
                const deckPart = DEFAULT_DECK_PART_ARR[index];
                const deckPartCards = deck.parts.get(deckPart)!;

                if (deckPartList.length > 0) {
                    deckPartList.split(DELIMITERS.passcode).forEach((entry) => {
                        let count = 1;
                        let passcode = entry;
                        if (entry.startsWith(DELIMITERS.cardAmount)) {
                            count = Number(entry[1]);
                            passcode = entry.slice(2);
                        }

                        if (
                            !this.cardDatabase.hasCard(
                                passcode,
                                FindCardBy.PASSCODE
                            )
                        ) {
                            throw new TypeError(
                                `Unknown card ${passcode}, this hopefully should never happen.`
                            );
                        }
                        const card = this.cardDatabase.getCard(
                            passcode,
                            FindCardBy.PASSCODE
                        )!;

                        for (let i = 0; i < count; i++) {
                            deckPartCards.push(card);
                        }
                    });
                }
            });

        return deck;
    }

    private encodeCardBlock(card: Card): Uint8Array {
        return this.encodeNumber(Number(card.passcode));
    }

    private decodeCardBlock(block: Uint8Array): Card {
        const passcode = String(this.decodeNumber(block));
        if (!this.cardDatabase.hasCard(passcode, FindCardBy.PASSCODE)) {
            throw new TypeError(
                `Could not find card for passcode '${passcode}'.`
            );
        }

        return this.cardDatabase.getCard(passcode, FindCardBy.PASSCODE)!;
    }

    private encodeNumber(number: number): Uint8Array {
        if (number <= 0 || number >= DeckUriEncodingService.LIMIT) {
            throw new TypeError(
                `Number '${number} is of range (has to be > 0 and < ${DeckUriEncodingService.LIMIT})'.`
            );
        }
        // Use a data view to set a 32 bit to the buffer, which is then returned as 8 bit array.
        const buffer = new ArrayBuffer(DeckUriEncodingService.BLOCK_BYTE_SIZE);
        new DataView(buffer).setUint32(
            0,
            number,
            DeckUriEncodingService.URL_QUERY_PARAM_VALUE_LITTLE_ENDIAN
        );
        return new Uint8Array(buffer);
    }

    private decodeNumber(block: Uint8Array): number {
        // See #encodeNumber for details
        return new DataView(block.buffer).getUint32(
            0,
            DeckUriEncodingService.URL_QUERY_PARAM_VALUE_LITTLE_ENDIAN
        );
    }

    private encodeBase64String(
        arr: Uint8Array,
        useUriParamSafeAlphabet: boolean
    ): string {
        let encoded = fromByteArray(arr);
        if (useUriParamSafeAlphabet) {
            encoded = encoded
                .replace(/=/g, "~")
                .replace(/\+/g, "_")
                .replace(/\//g, "-");
        }
        return encoded;
    }

    private decode64String(
        str: string,
        useUriParamSafeAlphabet: boolean
    ): Uint8Array {
        let encoded = str;
        if (useUriParamSafeAlphabet) {
            encoded = encoded
                .replace(/~/g, "=")
                .replace(/_/g, "+")
                .replace(/-/g, "/");
        }
        return toByteArray(encoded);
    }
}

export { DeckUriEncodingService };
