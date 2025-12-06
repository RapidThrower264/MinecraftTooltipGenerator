const TEMPLATES = [
    {
        "name": "Item",
        "description": "{rarity_color}Awesome Item Name\n&7Text goes here...\n\n{rarity_color}&l{rarity}",
    },
    {
        "name": "Item with Ability",
        "description": "{rarity_color}Awesome Item Name\n\n&6Ability: Power of Templates! &e&lRIGHT CLICK\n&7It doesn't really do much...\n\n{rarity_color}&l{rarity}",
    },
    {
        "name": "Pet",
        "description": "&8[Lvl 100] {rarity_color}Pet Name\n&8<Skill Type> Pet\n\n&6Pet Pal\n&7Just follows you around.\n\n&b&lMAX LEVEL\n&8{symbol} 25,353,230 XP",
        "symbol": "&#x25B8;"
    },
    {
        "name": "Collection Item",
        "description": "{rarity_color}Awesome Item Name\n&8Collection Item\n\n&7Text goes here...\n\n{rarity_color}&l{rarity}",
    },
    
];

const RARITIES = {
    "COMMON": {"name": "COMMON", "color": "WHITE"},
    "UNCOMMON": {"name": "UNCOMMON", "color": "GREEN"},
    "RARE": {"name": "RARE", "color": "BLUE"},
    "EPIC": {"name": "EPIC", "color": "DARK_PURPLE"},
    "LEGENDARY": {"name": "LEGENDARY", "color": "GOLD"},
    "MYTHIC": {"name": "MYTHIC", "color": "LIGHT_PURPLE"},
    "DIVINE": {"name": "DIVINE", "color": "AQUA"},
    "SPECIAL": {"name": "SPECIAL", "color": "RED"},
    "VERY SPECIAL": {"name": "VERY SPECIAL", "color": "RED"}
}