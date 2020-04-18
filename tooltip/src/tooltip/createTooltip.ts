import {
    Card,
    CardTypeGroup,
    DEFAULT_CURRENCY,
    Format,
} from "../../../core/src/main";
import { createCurrencyFormatter } from "../../../ui/src/main";

const currencyFormat = createCurrencyFormatter(DEFAULT_CURRENCY);

const createElement = (classes: string[], type: string): HTMLElement => {
    const element = document.createElement(type);
    classes.forEach((className) => element.classList.add(className));
    return element;
};

const createDiv = (
    classes: string[],
    children: HTMLElement[]
): HTMLDivElement => {
    const element = createElement(classes, "span") as HTMLDivElement;
    children.forEach((child) => element.appendChild(child));
    return element;
};

const createSpan = (
    classes: string[],
    textContent: string
): HTMLSpanElement => {
    const element = createElement(classes, "span") as HTMLSpanElement;
    element.textContent = textContent;
    return element;
};

const createParagraph = (
    classes: string[],
    textContent: string
): HTMLSpanElement => {
    const element = createElement(classes, "p") as HTMLParagraphElement;
    element.textContent = textContent;
    return element;
};

const createImg = (classes: string[], src: string): HTMLImageElement => {
    const element = createElement(classes, "img") as HTMLImageElement;
    element.src = src;
    return element;
};

const createMonsterStats = (card: Card): HTMLElement => {
    const statsChildren: HTMLElement[] = [];
    const statImage = createImg(
        [],
        "https://ygoprodeck.com/wp-content/uploads/2017/01/atk.png"
    );
    statsChildren.push(statImage);
    if (card.atk != null) {
        statsChildren.push(createSpan([], `ATK/ ${card.atk}`));
    }
    if (card.def != null) {
        statsChildren.push(createSpan([], `DEF/ ${card.def}`));
    } else if (card.linkVal != null) {
        statsChildren.push(createSpan([], `LINK-${card.linkVal}`));
    }
    return createDiv(["card-tooltip__stats"], statsChildren);
};

const createSubType = (card: Card, isMonster: boolean): HTMLElement => {
    const subTypeChildren: HTMLElement[] = [];

    if (isMonster) {
        const attribute = createDiv(
            [],
            [
                createImg(
                    [],
                    `https://ygoprodeck.com/pics/${encodeURIComponent(
                        card.attribute!
                    )}.jpg`
                ),
                createSpan([], `Attribute: ${card.attribute!}`),
            ]
        );
        subTypeChildren.push(attribute);

        const race = createDiv(
            [],
            [
                createImg(
                    [],
                    `https://ygoprodeck.com/pics/${encodeURIComponent(
                        card.race
                    )}.png`
                ),
                createSpan([], `Race: ${card.race}`),
            ]
        );
        subTypeChildren.push(race);
    } else {
        const subtype = createDiv(
            [],
            [
                createImg(
                    [],
                    `https://ygoprodeck.com/pics/icons/${encodeURIComponent(
                        card.race
                    )}.png`
                ),
                createSpan([], `Sub-type: ${card.race}`),
            ]
        );
        subTypeChildren.push(subtype);
    }

    return createDiv(["card-tooltip__subtype"], subTypeChildren);
};

const createPrices = (card: Card): HTMLElement => {
    const priceItems: HTMLElement[] = [];
    for (const [vendor, price] of card.prices.entries()) {
        const priceItem = createSpan(
            ["price__vendor", `price__vendor--${vendor.id}`],
            `${vendor.name}: ${currencyFormat.format(price)}`
        );
        priceItems.push(priceItem);
    }
    return createDiv(
        ["card-tooltip__prices"],
        [createDiv(["price"], priceItems)]
    );
};

const createCardDetailsCol = (card: Card): HTMLElement => {
    const children: HTMLElement[] = [];

    const primaryDetails = createDiv(
        ["card-tooltip__details"],
        [
            createImg(
                [],
                `https://ygoprodeck.com/pics/icons/${encodeURIComponent(
                    card.type.name
                )}.jpg`
            ),
            createSpan(["card-tooltip__name"], card.name),
            createImg(
                [],
                `https://ygoprodeck.com/pics/icons/${encodeURIComponent(
                    card.banlist[Format.TCG].name
                )}.png`
            ),
        ]
    );
    children.push(primaryDetails);

    const isMonster = card.type.group === CardTypeGroup.MONSTER;
    if (isMonster) {
        children.push(createMonsterStats(card));
    }

    children.push(createSubType(card, isMonster));

    if (isMonster) {
        if (card.level != null) {
            const level = createDiv(
                ["card-tooltip__level"],
                [
                    createImg(
                        [],
                        "https://ygoprodeck.com/wp-content/uploads/2017/01/level.png"
                    ),
                    createSpan([], `Level/Rank: ${card.level}`),
                ]
            );
            children.push(level);
        } else if (card.linkMarkers != null) {
            const linkMarkers = createDiv(
                [],
                [
                    createImg(
                        [],
                        "https://ygoprodeck.com/wp-content/uploads/2019/04/link-arrow-right.png"
                    ),
                    createSpan(
                        [],
                        `Link Markers: ${card.linkMarkers.join(", ")}`
                    ),
                ]
            );
            children.push(linkMarkers);
        }
    }

    const desc = createDiv(
        ["card-tooltip__description"],
        [createParagraph([], card.desc)]
    );
    children.push(desc);

    children.push(createPrices(card));

    return createDiv(["card-tooltip__details__col"], children);
};

const createVote = (val: number, icon: string): HTMLElement =>
    createDiv(
        [],
        [
            createSpan(["fas", `fa-arrow-${icon}`], ""),
            createSpan([], String(val)),
        ]
    );

const createCardImageCol = (card: Card): HTMLElement => {
    const votes = createDiv(
        ["card-tooltip__votes"],
        [createVote(card.votes.up, "up"), createVote(card.votes.down, "down")]
    );
    const cardImage = createImg(
        ["card-tooltip__image"],
        card.image?.url ?? "#"
    );
    return createDiv(["card-tooltip__image__col"], [cardImage, votes]);
};

export const createTooltip = (card: Card): HTMLElement =>
    createDiv(
        ["card-tooltip__content"],
        [createCardDetailsCol(card), createCardImageCol(card)]
    );