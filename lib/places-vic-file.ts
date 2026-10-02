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

// The ABS credit the licence asks for, in BUZ's words (option A, 2 Oct:
// "lets go" on Leo's and the Head of Product Design's recommendation). Shown
// once, at the foot of the /trials filter panel — the phone panel and the
// laptop rail — because Region and Distance both stand on this data.
export const ABS_CREDIT = 'Suburb and postcode data: Australian Bureau of Statistics, CC BY 4.0.';
