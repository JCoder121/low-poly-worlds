// The travelers' library: ~100 world-history doorways.
// Labels are what the traveler says; keep them lowercase, curious, short.
const W = (t) => `https://en.wikipedia.org/wiki/${t}`;

export const LINKS = [
  // japan & the book's world
  { label: "miyamoto musashi", url: W("Miyamoto_Musashi") },
  { label: "the book of five rings", url: W("The_Book_of_Five_Rings") },
  { label: "the sengoku period", url: W("Sengoku_period") },
  { label: "the battle of sekigahara", url: W("Battle_of_Sekigahara") },
  { label: "history of japan", url: W("History_of_Japan") },
  { label: "bushido", url: W("Bushido") },
  { label: "the samurai", url: W("Samurai") },
  { label: "sumi-e ink painting", url: W("Ink_wash_painting") },
  { label: "cherry blossoms", url: W("Cherry_blossom") },
  { label: "the edo period", url: W("Edo_period") },
  { label: "zen buddhism", url: W("Zen") },
  { label: "the tea ceremony", url: W("Japanese_tea_ceremony") },
  { label: "the ronin", url: W("R%C5%8Dnin") },
  { label: "japanese castles", url: W("Japanese_castle") },
  { label: "the tokugawa shogunate", url: W("Tokugawa_shogunate") },
  { label: "haiku", url: W("Haiku") },
  { label: "the forty-seven ronin", url: W("Forty-seven_r%C5%8Dnin") },
  { label: "japanese swordsmithing", url: W("Japanese_swordsmithing") },

  // asia
  { label: "history of asia", url: W("History_of_Asia") },
  { label: "the silk road", url: W("Silk_Road") },
  { label: "the mongol empire", url: W("Mongol_Empire") },
  { label: "the great wall", url: W("Great_Wall_of_China") },
  { label: "the ming dynasty", url: W("Ming_dynasty") },
  { label: "the art of war", url: W("The_Art_of_War") },
  { label: "genghis khan", url: W("Genghis_Khan") },
  { label: "the taj mahal", url: W("Taj_Mahal") },
  { label: "the mughal empire", url: W("Mughal_Empire") },
  { label: "the khmer empire", url: W("Khmer_Empire") },
  { label: "angkor wat", url: W("Angkor_Wat") },
  { label: "the joseon dynasty", url: W("Joseon") },
  { label: "the ottoman empire", url: W("Ottoman_Empire") },
  { label: "the persian empire", url: W("Achaemenid_Empire") },
  { label: "zheng he's voyages", url: W("Zheng_He") },
  { label: "the terracotta army", url: W("Terracotta_Army") },

  // europe & the mediterranean
  { label: "history of europe", url: W("History_of_Europe") },
  { label: "the roman empire", url: W("Roman_Empire") },
  { label: "the renaissance", url: W("Renaissance") },
  { label: "ancient greece", url: W("Ancient_Greece") },
  { label: "the vikings", url: W("Vikings") },
  { label: "the printing press", url: W("Printing_press") },
  { label: "leonardo da vinci", url: W("Leonardo_da_Vinci") },
  { label: "the hanseatic league", url: W("Hanseatic_League") },
  { label: "the age of sail", url: W("Age_of_Sail") },
  { label: "the library of alexandria", url: W("Library_of_Alexandria") },
  { label: "the byzantine empire", url: W("Byzantine_Empire") },
  { label: "the medici", url: W("House_of_Medici") },
  { label: "stonehenge", url: W("Stonehenge") },
  { label: "the norman conquest", url: W("Norman_Conquest") },
  { label: "the enlightenment", url: W("Age_of_Enlightenment") },
  { label: "the industrial revolution", url: W("Industrial_Revolution") },

  // africa & the middle east
  { label: "ancient egypt", url: W("Ancient_Egypt") },
  { label: "the pyramids of giza", url: W("Giza_pyramid_complex") },
  { label: "the mali empire", url: W("Mali_Empire") },
  { label: "mansa musa", url: W("Mansa_Musa") },
  { label: "timbuktu", url: W("Timbuktu") },
  { label: "great zimbabwe", url: W("Great_Zimbabwe") },
  { label: "the kingdom of aksum", url: W("Kingdom_of_Aksum") },
  { label: "mesopotamia", url: W("Mesopotamia") },
  { label: "the code of hammurabi", url: W("Code_of_Hammurabi") },
  { label: "the islamic golden age", url: W("Islamic_Golden_Age") },
  { label: "the house of wisdom", url: W("House_of_Wisdom") },
  { label: "petra", url: W("Petra") },

  // the americas
  { label: "the aztec empire", url: W("Aztecs") },
  { label: "the inca road system", url: W("Inca_road_system") },
  { label: "machu picchu", url: W("Machu_Picchu") },
  { label: "the maya civilization", url: W("Maya_civilization") },
  { label: "cahokia", url: W("Cahokia") },
  { label: "the columbian exchange", url: W("Columbian_exchange") },
  { label: "the oregon trail", url: W("Oregon_Trail") },
  { label: "the transcontinental railroad", url: W("First_transcontinental_railroad") },
  { label: "the gold rush", url: W("California_gold_rush") },
  { label: "how hollywood began", url: W("History_of_Hollywood") },
  { label: "the golden age of hollywood", url: W("Classical_Hollywood_cinema") },
  { label: "the harlem renaissance", url: W("Harlem_Renaissance") },

  // exploration, exchange & ideas
  { label: "the age of discovery", url: W("Age_of_Discovery") },
  { label: "polynesian navigation", url: W("Polynesian_navigation") },
  { label: "the compass", url: W("Compass") },
  { label: "the history of paper", url: W("History_of_paper") },
  { label: "the history of tea", url: W("History_of_tea") },
  { label: "the spice trade", url: W("Spice_trade") },
  { label: "the history of chess", url: W("History_of_chess") },
  { label: "the history of writing", url: W("History_of_writing") },
  { label: "the rosetta stone", url: W("Rosetta_Stone") },
  { label: "the history of astronomy", url: W("History_of_astronomy") },
  { label: "the antikythera mechanism", url: W("Antikythera_mechanism") },
  { label: "the history of cartography", url: W("History_of_cartography") },
  { label: "the history of money", url: W("History_of_money") },
  { label: "the history of medicine", url: W("History_of_medicine") },
  { label: "the olympic games", url: W("Ancient_Olympic_Games") },
  { label: "the history of gardens", url: W("History_of_gardening") },
  { label: "the history of the book", url: W("History_of_books") },

  // war, peace & turning points
  { label: "the hundred years' war", url: W("Hundred_Years%27_War") },
  { label: "the fall of constantinople", url: W("Fall_of_Constantinople") },
  { label: "the meiji restoration", url: W("Meiji_Restoration") },
  { label: "the french revolution", url: W("French_Revolution") },
  { label: "the treaty of westphalia", url: W("Peace_of_Westphalia") },
  { label: "the black death", url: W("Black_Death") },
  { label: "the moon landing", url: W("Apollo_11") },
  { label: "the history of the internet", url: W("History_of_the_Internet") },
];

// Shuffled deck so links don't repeat until the deck is exhausted.
export function makeLinkDeck() {
  let deck = [];
  return function draw() {
    if (deck.length === 0) {
      deck = [...LINKS];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop();
  };
}
