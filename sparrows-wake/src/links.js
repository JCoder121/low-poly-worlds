// The sea's little library: 30 piracy & maritime-history doorways.
// Labels stay lowercase and clean — traffic.js appends the trailing " →".
const W = (t) => `https://en.wikipedia.org/wiki/${t}`;

export const LINKS = [
  // the golden age & its articles of piracy
  { label: "the golden age of piracy", url: W("Golden_Age_of_Piracy") },
  { label: "letters of marque", url: W("Letter_of_marque") },
  { label: "privateers", url: W("Privateer") },
  { label: "the brethren of the coast", url: W("Brethren_of_the_Coast") },
  { label: "the jolly roger", url: W("Jolly_Roger") },
  { label: "walking the plank", url: W("Walking_the_plank") },
  { label: "marooning", url: W("Marooning") },
  { label: "buried treasure", url: W("Buried_treasure") },

  // the famous hands
  { label: "blackbeard", url: W("Blackbeard") },
  { label: "anne bonny", url: W("Anne_Bonny") },
  { label: "mary read", url: W("Mary_Read") },
  { label: "calico jack", url: W("Calico_Jack") },
  { label: "bartholomew roberts", url: W("Bartholomew_Roberts") },
  { label: "captain henry morgan", url: W("Henry_Morgan") },
  { label: "captain kidd", url: W("William_Kidd") },
  { label: "the barbary corsairs", url: W("Barbary_pirates") },

  // haunts & waters
  { label: "the spanish main", url: W("Spanish_Main") },
  { label: "port royal", url: W("Port_Royal") },
  { label: "tortuga", url: W("Tortuga_(Haiti)") },
  { label: "the doldrums", url: W("Doldrums") },
  { label: "the trade winds", url: W("Trade_winds") },

  // ships, spoils & sailor's lore
  { label: "the galleon", url: W("Galleon") },
  { label: "the sloop", url: W("Sloop") },
  { label: "pieces of eight", url: W("Spanish_dollar") },
  { label: "grog", url: W("Grog") },
  { label: "scurvy", url: W("Scurvy") },
  { label: "celestial navigation", url: W("Celestial_navigation") },
  { label: "a message in a bottle", url: W("Message_in_a_bottle") },
  { label: "davy jones' locker", url: W("Davy_Jones%27_Locker") },
  { label: "the flying dutchman", url: W("Flying_Dutchman") },
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
