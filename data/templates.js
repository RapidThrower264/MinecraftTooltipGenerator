function convertFromHTMLEntity(htmlEntity) {
    return String.fromCharCode(parseInt(htmlEntity.replaceAll(/[&#x;]/gm, ""), 16));
}

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
        "description": "&7[Lvl 100] {rarity_color}Pet Name\n&8<Skill Type> Pet\n\n&6Pet Pal\n&7Just follows you around.\n\n&b&lMAX LEVEL\n&8{symbol} 25,353,230 XP",
        "special": {"symbol": () => convertFromHTMLEntity("&#x25B8;")}
    },
    {
        "name": "Collection Item",
        "description": "{rarity_color}Awesome Item Name\n&8Collection Item\n\n&7Text goes here...\n\n{rarity_color}&l{rarity}",
    },
    {
        "name": "Attribute Shard",
        "description": "{rarity_color}Designer Shard\n&6Item Creator I\n&7Your concepts are &a+1% &7better.\n\nYou can Syphon this shard from\nyour &aHunting Box&7.\n\n&eRight-click to send to Hunting Box!\nShift Right-click to move all!\n\n&4{symbol} &cRequires &aHunting Skill I&a.\n{rarity_color}&l{rarity} SHARD &8(ID {initial}264)",
        "special": {"initial": (rarity) => rarity.name.charAt(0),
        "symbol": () => convertFromHTMLEntity("&#x2763;")},
    }
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