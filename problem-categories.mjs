export const PROBLEM_CATEGORY_DEFINITIONS = [
    {
        key: "work",
        label: "Töö ja vastutus",
        shortLabel: "Töö",
        accent: "#1f7666",
        accentSoft: "rgba(31, 118, 102, 0.16)",
        aliases: ["töö ja tempo", "töö", "vastutus", "karjäär"],
        insight: "Kõige sagedamini jookseb pinge töötempo, tähtaegade ja vastutuse ümber.",
        meta: "Tööga seotud pinge on vaibunud ja koormus on taas paigas.",
        keywords: ["töö", "projekt", "tähtaeg", "klient", "boss", "juht", "koosolek", "kolleeg", "karjäär", "vastutus", "tempo"],
        resolved: "Lahenes tööga seotud surve, mis venitas tähelepanu ja sisemist rahu.",
        state: "Töö on taas kontrolli all ja päev tundub selgem.",
        summary: "Tööteema ei paina enam ja fookus on tagasi."
    },
    {
        key: "money",
        label: "Raha ja kohustused",
        shortLabel: "Raha",
        accent: "#c58a2d",
        accentSoft: "rgba(197, 138, 45, 0.18)",
        aliases: ["raha ja asjaajamine", "raha", "kohustused", "asjaajamine"],
        insight: "Raha, arved ja kohustused moodustavad väga suure osa lugejate murest.",
        meta: "Rahaline olukord on stabiilsem ja igapäevane pinge on taandunud.",
        keywords: ["raha", "palk", "eelarve", "võlg", "laen", "arve", "kulud", "sissetulek", "makse", "asjaajamine"],
        resolved: "Lahenes rahaline pinge, mis tekitas nappuse või kohustuste survet.",
        state: "Rahaline seis on rahulikum, kindlam ja tasakaalus.",
        summary: "Raha ei mõju enam pideva probleemina."
    },
    {
        key: "relationships",
        label: "Suhted ja suhtlus",
        shortLabel: "Suhted",
        accent: "#cf6d5b",
        accentSoft: "rgba(207, 109, 91, 0.18)",
        aliases: ["inimesed ja suhted", "suhted", "suhtlus", "inimesed"],
        insight: "Väga palju hõõrdumist tuleb suhetest, ütlemata asjadest ja pingelisest suhtlusest.",
        meta: "Suhtlus on pehmem, lähedus on taastunud ja pinge on taandunud.",
        keywords: ["suhe", "partner", "sõber", "pere", "ema", "isa", "abikaasa", "tüli", "konflikt", "suhtlus", "inimesed"],
        resolved: "Lahenes suhte või suhtluse ümber olnud pinge.",
        state: "Suhe on soojem, vastastikune ja tasakaalus.",
        summary: "See suheteema ei hoia enam midagi kinni."
    },
    {
        key: "home",
        label: "Kodu ja igapäev",
        shortLabel: "Kodu",
        accent: "#a36b43",
        accentSoft: "rgba(163, 107, 67, 0.18)",
        aliases: ["kodused asjad", "kodu", "olme", "igapäev"],
        insight: "Üllatavalt suur osa murest koguneb kodu, olme ja venivate igapäevaasjade ümber.",
        meta: "Igapäevane korraldus on paigas ja kodune pinge on taandunud.",
        keywords: ["kodu", "kodune", "korter", "maja", "remont", "naaber", "majapidamine", "olme", "igapäev", "segadus"],
        resolved: "Lahenes koduse korralduse või olme ümber olnud pinge.",
        state: "Kodune rütm on selgem ja asjad on taas omal kohal.",
        summary: "Kodune teema ei hõõru enam päevast energiat."
    },
    {
        key: "health",
        label: "Tervis ja koormus",
        shortLabel: "Koormus",
        accent: "#4f9c87",
        accentSoft: "rgba(79, 156, 135, 0.18)",
        aliases: ["pea ja energia", "tervis", "koormus", "energia"],
        insight: "Lugejad toovad väga sageli sisse stressi, väsimuse ja sisemise ülekoormuse teemasid.",
        meta: "Koormus on leevenenud ja sisemine rahu on tagasi.",
        keywords: ["stress", "ärevus", "väsimus", "tervis", "uni", "läbipõlemine", "kurnatus", "pinge", "depressioon", "energia"],
        resolved: "Lahenes pinge või ülekoormuse osa, mis kurnas kõige rohkem.",
        state: "Enesetunne on ühtlasem ja olukord ei rõhu enam.",
        summary: "See teema ei koorma enam samal viisil."
    },
    {
        key: "decision",
        label: "Otsus ja suunavalik",
        shortLabel: "Otsus",
        accent: "#5f7ecb",
        accentSoft: "rgba(95, 126, 203, 0.18)",
        aliases: ["otsus", "suunavalik", "valik"],
        insight: "Suur osa probleeme tekib kohtades, kus valik on lahti ja suund pole veel paigas.",
        meta: "Suund on selge ja sisemine kõhklus on taandunud.",
        keywords: ["otsus", "valik", "valima", "kas", "kolida", "lahkuda", "jääda", "suund", "variant"],
        resolved: "Lahenes valiku ümber olnud ebaselgus.",
        state: "Otsus on paigas ja edasi liikumine on lihtsam.",
        summary: "See küsimus ei ripu enam õhus."
    }
];

export const GENERAL_PROBLEM_CATEGORY = {
    key: "general",
    label: "Segateemad",
    shortLabel: "Segu",
    accent: "#607182",
    accentSoft: "rgba(96, 113, 130, 0.18)",
    aliases: ["muu", "üldine", "üldine olukord", "segateemad", "segateema"],
    insight: "Osa lugusid puudutab korraga mitut valdkonda ega mahu puhtalt ühe rubriigi alla.",
    meta: "Varasem ebaselgus on taandunud ja olukord mõjub kindlamalt.",
    keywords: [],
    resolved: "Lahenes pinge või ebaselguse osa, mis hoidis teemat lahtisena.",
    state: "Olukord on nüüd selgem, rahulikum ja lõpetatud.",
    summary: "Algne segadus on läbi ja tunne on kindlam."
};

export const ALL_PROBLEM_CATEGORIES = [
    ...PROBLEM_CATEGORY_DEFINITIONS,
    GENERAL_PROBLEM_CATEGORY
];

export const PROBLEM_CATEGORY_LABELS = ALL_PROBLEM_CATEGORIES.map(function (category) {
    return category.label;
});

function normalizeCategorySource(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("et-EE");
}

function matchesProblemCategory(category, value) {
    const haystack = normalizeCategorySource(value);

    if (!haystack) {
        return false;
    }

    return [category.label, category.shortLabel]
        .concat(category.aliases || [])
        .concat(category.keywords || [])
        .some(function (token) {
            return haystack.includes(normalizeCategorySource(token));
        });
}

export function getProblemCategoryDefinition(label) {
    return ALL_PROBLEM_CATEGORIES.find(function (category) {
        return normalizeCategorySource(category.label) === normalizeCategorySource(label);
    }) || GENERAL_PROBLEM_CATEGORY;
}

export function detectProblemCategory(text) {
    return PROBLEM_CATEGORY_DEFINITIONS.find(function (category) {
        return matchesProblemCategory(category, text);
    }) || GENERAL_PROBLEM_CATEGORY;
}

export function resolveProblemCategory(suggestedType, problemText) {
    const normalizedSuggestedType = normalizeCategorySource(suggestedType);
    const exactMatch = ALL_PROBLEM_CATEGORIES.find(function (category) {
        return normalizeCategorySource(category.label) === normalizedSuggestedType;
    });

    if (exactMatch) {
        return exactMatch;
    }

    const suggestedMatch = PROBLEM_CATEGORY_DEFINITIONS.find(function (category) {
        return matchesProblemCategory(category, suggestedType);
    });

    if (suggestedMatch) {
        return suggestedMatch;
    }

    return detectProblemCategory(problemText || suggestedType);
}
