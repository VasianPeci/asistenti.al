const SOURCE_NAMES: Record<string, string> = {
  "pasaporta.txt": "DPGJC · dpgjc.gov.al",
  "biznes_nipt.txt": "QKB · qkb.gov.al",
  "patente.txt": "DPSHTRR · dpshtrr.gov.al",
  "regjistrim_automjeti.txt": "DPSHTRR · dpshtrr.gov.al",
  "leje_qendrimi.txt": "Drejtoria e Migracionit · punetebrendshme.gov.al",
  "certifikate_lindje.txt": "Gjendja Civile · e-albania.al",
  "martese.txt": "Gjendja Civile · e-albania.al",
  "karte_identiteti.txt": "Drejtoria e Përgjithshme e Gjendjes Civile · e-albania.al",
  "regjistrim_prone.txt": "ASHK · ashk.gov.al",
  "punesimi.txt": "AKPA · akpa.gov.al",
  "pensioni.txt": "ISSH · issh.gov.al",
  "tatime.txt": "Drejtoria e Tatimeve · tatime.gov.al",
  "matura.txt": "Ministria e Arsimit · arsimi.gov.al",
  "universitet.txt": "Ministria e Arsimit · arsimi.gov.al",
  "diplome.txt": "Ministria e Arsimit · arsimi.gov.al",
};

export function friendlySource(rawSource: string | null | undefined): string | null {
  if (!rawSource) return null;
  if (SOURCE_NAMES[rawSource]) return SOURCE_NAMES[rawSource]!;
  const basename = rawSource.split("/").pop() ?? rawSource;
  if (SOURCE_NAMES[basename]) return SOURCE_NAMES[basename]!;
  return basename.replace(/\.[a-z]+$/i, "").replace(/[_-]/g, " ");
}

export function friendlySources(rawSources: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawSources) {
    const friendly = friendlySource(raw);
    if (friendly && !seen.has(friendly)) {
      seen.add(friendly);
      out.push(friendly);
    }
  }
  return out;
}
