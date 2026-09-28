/**
 * Name pools for the fictional demo roster (§37).
 *
 * Every combination below is invented for FIGHTRANK. The pools are deliberately
 * built from uncommon surnames so that generated combinations do not collide
 * with real professional fighters. No real athlete, promotion or trademark is
 * referenced anywhere in the demo data.
 */

export const FIRST_NAMES_MEN = [
  'Dario', 'Kenji', 'Marek', 'Tobias', 'Rashid', 'Emeka', 'Andrei', 'Casimir',
  'Odell', 'Bruno', 'Ilya', 'Tamas', 'Nikola', 'Javier', 'Rueben', 'Soren',
  'Malachi', 'Ezra', 'Dimitri', 'Cato', 'Hiro', 'Anselm', 'Luka', 'Ferran',
  'Osman', 'Thiago', 'Vicente', 'Kwame', 'Anders', 'Mateus', 'Zoran', 'Ravi',
  'Lucien', 'Damek', 'Aurelio', 'Bastien', 'Corvin', 'Idris', 'Joao', 'Nestor',
  'Tarek', 'Vadim', 'Yannick', 'Amias', 'Bolin', 'Cormac', 'Dmitri', 'Elio',
  'Fabio', 'Gideon', 'Hasan', 'Ignacio', 'Jarek', 'Kofi', 'Laszlo', 'Milos',
  'Noam', 'Otto', 'Pavlo', 'Quentin', 'Renzo', 'Sami', 'Teodor', 'Ulric',
]

export const FIRST_NAMES_WOMEN = [
  'Selma', 'Noor', 'Ingrid', 'Camila', 'Yuki', 'Adaeze', 'Petra', 'Rowan',
  'Inez', 'Marta', 'Zofia', 'Hana', 'Lucia', 'Ondine', 'Farida', 'Beatriz',
  'Katia', 'Nadia', 'Sionne', 'Talia', 'Vesna', 'Wren', 'Ximena', 'Yara',
  'Anouk', 'Brita', 'Celestine', 'Dalia', 'Elowen', 'Freya', 'Gilda', 'Halina',
  'Ilaria', 'Juno', 'Kaia', 'Liora', 'Mira', 'Neve', 'Orla', 'Paloma',
]

export const LAST_NAMES = [
  'Vasquez-Moor', 'Okonkwo', 'Brandtvik', 'Deleon-Roche', 'Tanaka-Reyes',
  'Halvorsen', 'Marchetti', 'Dubrowski', 'Ferreira-Lund', 'Kovacevic',
  'Adeyemi', 'Sorrentino', 'Larkin-Ross', 'Nakamura-Diaz', 'Petrosyan',
  'Balthazar', 'Quintero-Vale', 'Strand', 'Ilunga', 'Vespucci',
  'Barros-Neto', 'Cardenal', 'Delacroix', 'Eriksen-Bhat', 'Fontaine',
  'Guzman-Pike', 'Hollows', 'Ivanovic', 'Jarosik', 'Kalunga',
  'Lindqvist', 'Mbeki-Stone', 'Novara', 'Oyelaran', 'Prieto-Varga',
  'Rasmussen', 'Salcedo', 'Tarkanian', 'Ubiratan', 'Volkoff',
  'Weatherby', 'Xhaka-Morel', 'Yilmaz', 'Zabrowski', 'Ashgrove',
  'Bellandi', 'Corvino', 'Dragomir', 'Esteva', 'Fenwick-Adu',
  'Grieveson', 'Hartsoe', 'Ikeda-Muniz', 'Jozwiak', 'Kestrel',
  'Lomeli', 'Mikhailov', 'Nurbek', 'Ostrander', 'Pemberton-Ide',
  'Quillan', 'Ravenhill', 'Sandoval-Koh', 'Thibault', 'Ugarte',
  'Vandercamp', 'Wolfhart', 'Yeboah', 'Zielinski', 'Anselmi',
  'Bjornsson-Rey', 'Castellan', 'Drakeford', 'Emberton', 'Falconi',
]

export const NICKNAMES = [
  'The Vault', 'Blackout', 'Cold Steel', 'The Metronome', 'Sandstorm',
  'The Archivist', 'Gravedigger', 'Quiet Storm', 'The Surgeon', 'Ironclad',
  'Nightshift', 'The Mechanic', 'Riptide', 'The Architect', 'Wildfire',
  'Glasscutter', 'The Undertow', 'Hammerhead', 'The Clockmaker', 'Kingtide',
  'Static', 'The Cartographer', 'Deadbolt', 'Thunderhead', 'The Locksmith',
  'Sawtooth', 'The Lighthouse', 'Ghost Step', 'Bonfire', 'The Prospector',
  'Whiplash', 'The Anvil', 'Sable', 'Hurricane Lamp', 'The Watchman',
  'Cinder', 'The Freight Train', 'Bluebeard', 'Nomad', 'The Alchemist',
  'Dustdevil', 'The Bailiff', 'Krakenhand', 'Slate', 'The Pathfinder',
  'Longshot', 'The Ferryman', 'Brimstone', 'Tungsten', 'The Cartel',
  'Halfmoon', 'The Bellringer', 'Redline', 'The Gatekeeper', 'Stormbreak',
]

export const COUNTRIES: Array<{ name: string; code: string }> = [
  { name: 'Brazil', code: 'BR' },
  { name: 'United States', code: 'US' },
  { name: 'Russia', code: 'RU' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Japan', code: 'JP' },
  { name: 'Poland', code: 'PL' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Australia', code: 'AU' },
  { name: 'France', code: 'FR' },
  { name: 'Sweden', code: 'SE' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Ireland', code: 'IE' },
  { name: 'Canada', code: 'CA' },
  { name: 'Georgia', code: 'GE' },
  { name: 'Kazakhstan', code: 'KZ' },
  { name: 'Spain', code: 'ES' },
  { name: 'Italy', code: 'IT' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Thailand', code: 'TH' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'Argentina', code: 'AR' },
]

export const TEAMS = [
  'Meridian Combat Club', 'Northgate Athletic', 'Sable Ridge MMA',
  'Ironworks Fight Team', 'Harbour Line Academy', 'Vantage Martial Arts',
  'Kestrel Performance', 'Old Foundry BJJ', 'Redstone Fight Lab',
  'Cobalt Coast Training', 'Ninth Street Boxing', 'Terra Nova Grappling',
]

export const VENUES: Array<{ venue: string; city: string; country: string; code: string }> = [
  { venue: 'Meridian Arena', city: 'Las Vegas', country: 'United States', code: 'US' },
  { venue: 'Harbour Dome', city: 'Sydney', country: 'Australia', code: 'AU' },
  { venue: 'Estádio Central', city: 'São Paulo', country: 'Brazil', code: 'BR' },
  { venue: 'Kensington Hall', city: 'London', country: 'United Kingdom', code: 'GB' },
  { venue: 'Nordlys Arena', city: 'Stockholm', country: 'Sweden', code: 'SE' },
  { venue: 'Sakura Coliseum', city: 'Tokyo', country: 'Japan', code: 'JP' },
  { venue: 'Puerta Grande', city: 'Mexico City', country: 'Mexico', code: 'MX' },
  { venue: 'Union Pavilion', city: 'Toronto', country: 'Canada', code: 'CA' },
  { venue: 'Kalahari Centre', city: 'Abu Dhabi', country: 'United Arab Emirates', code: 'AE' },
  { venue: 'Gdańsk Forum', city: 'Gdańsk', country: 'Poland', code: 'PL' },
  { venue: 'Vieux Port Arena', city: 'Marseille', country: 'France', code: 'FR' },
  { venue: 'Highland Bowl', city: 'Denver', country: 'United States', code: 'US' },
]
