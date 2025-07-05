export function parseDocxModifiedDate(coreXml: string) {
  const match = coreXml.match(
    /<dcterms:modified[^>]*>([^<]+)<\/dcterms:modified>/
  );
  return match ? new Date(match[1]) : null;
}

export function parseDocxVersion(coreXml: string) {
  const match = coreXml.match(/<cp:version[^>]*>([^<]+)<\/cp:version>/);
  return match ? match[1] : null;
}

export function parseDocxKeywords(coreXml: string) {
  const match = coreXml.match(/<cp:keywords[^>]*>([^<]+)<\/cp:keywords>/);
  return match ? match[1] : null;
}

export function parseDocxTitle(coreXml: string) {
  const match = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  return match ? match[1] : null;
}

export function parseDocxCreator(coreXml: string) {
  const match = coreXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
  return match ? match[1] : null;
}

export function parseDocxLastModifiedBy(coreXml: string) {
  const match = coreXml.match(
    /<cp:lastModifiedBy[^>]*>([^<]+)<\/cp:lastModifiedBy>/
  );
  return match ? match[1] : null;
}
