export type Kanal = "mejl" | "slack" | "teams";

export type Meddelande = {
  id: string;
  kanal: Kanal;
  fran: string;
  amne?: string;
  text: string;
};

export type Sortering = {
  avsandare: "kund" | "personal";
  kategori: "retur" | "frakt" | "rabattkod" | "storlek" | "orderstatus" | "övrigt";
  ordernummer: string | null;
  sammanfattning: string;
  bradskande: boolean;
};

export type Bedomning = {
  godkand: boolean;
  felHos: "ingen" | "utredaren" | "skribenten";
  problem: string[];
  aterkoppling: string;
  sakerAttSkicka?: boolean;
  motivering?: string;
};

export type Arendestatus = "att_godkanna" | "skickat" | "behover_manniska" | "avvisat";

export type Arende = {
  meddelande: Meddelande;
  sortering: Sortering;
  fakta: string;
  svar: string;
  bedomning: Bedomning;
  forsok: number;
  status: Arendestatus;
  autoskickat?: boolean;
  beslutAv?: string;
  uppdaterad: string;
};

export type Handelse =
  | { typ: "steg"; agent: "Sorteraren" | "Utredaren" | "Skribenten" | "Granskaren"; text: string; detalj?: string }
  | { typ: "verktyg"; namn: string; indata: string }
  | { typ: "fel"; text: string };

export type Kostatus = "i_ko" | "arbetar" | null;

export type Inkorgsrad = {
  meddelande: Meddelande;
  arende: Arende | null;
  ko: Kostatus;
  logg: Handelse[];
};

export type Testrad = {
  id: string;
  fraga: string;
  facit: string;
  svar: string;
  fakta: string;
  ratt: boolean | null;
  kommentar: string;
};

export type Testkorning = {
  startad: string;
  klar: boolean;
  antal: number;
  rader: Testrad[];
};
