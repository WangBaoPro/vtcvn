import { DeckPart } from "./DeckPart";
import { Card } from "./Card";

interface Deck {
    name: string | null;
    parts: Map<DeckPart, Card[]>;
}

export { Deck };
