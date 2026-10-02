// The Victorian places file: every suburb and locality, its postcode, its
// council and a centre point (trials board filters, BUZ approved 2 Oct).
// Written by scripts/places-vic.mjs; its name carries a hash of its contents,
// so a new edition is a new address. This module is only its name, so the
// browser can fetch it without the file being bundled into anything.
//
// THE DATA, beside the file that names it (Leo, 2 Oct):
//   Source:  Australian Bureau of Statistics, Australian Statistical
//            Geography Standard (ASGS) Edition 3, from the ABS map services:
//              https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/2   (localities and their points)
//              https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0   (locality boundaries, for one postcode)
//              https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/1   (postal areas)
//              https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/2   (postal area points)
//              https://geo.abs.gov.au/arcgis/rest/services/ASGS2025/LGA/MapServer/1   (councils)
//   Version: Suburbs and Localities 2021, Postal Areas 2021, Local Government
//            Areas 2025. Read 2 Oct 2026. The file carries the same in its
//            own "v" and "src".
//   Licence: Creative Commons Attribution 4.0 International (CC BY 4.0). It
//            needs a credit line where we use it — ABS_CREDIT below.
export const PLACES_FILE = '/places-vic.4306391711.json';

// PENDING_BUZ_WORDS — the ABS credit the licence asks for. It is NOT approved
// copy (Leo, 2 Oct: "that line is NOT among the approved words"), so nothing
// renders it yet, and Distance does not ship until BUZ has said yes to it.
export const ABS_CREDIT_PENDING_BUZ_WORDS =
  'Suburb, postcode and council data: Australian Bureau of Statistics, ASGS Edition 3, CC BY 4.0.';
