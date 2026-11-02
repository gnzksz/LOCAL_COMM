// =====================================================================================================
//  EDIT HERE: the details shown on the landing page (footer, contact, hotlines, sample numbers).
//  Every value marked [PLACEHOLDER] is made up. Replace it with your barangay's real information.
//  Save the file and redeploy (npm run deploy:web inside the firebase folder).
// =====================================================================================================
window.SITE = {
  // The public address of the site, used for the share image and the canonical link in index.html.
  url: 'https://local-comm-bdae9.web.app/',

  office: {
    name: 'Barangay Hall',                                  // [PLACEHOLDER] e.g. "Barangay San Isidro Hall"
    address: '[PLACEHOLDER] Street, Barangay, City, Province',
    phone: '(000) 000-0000',                                // [PLACEHOLDER]
    email: 'barangay@example.com',                          // [PLACEHOLDER]
  },

  // Office hours, one line each.
  hours: [
    ['Monday to Friday', '8:00 AM – 5:00 PM'],              // [PLACEHOLDER]
    ['Saturday', '8:00 AM – 12:00 NN'],                     // [PLACEHOLDER]
    ['Sunday and holidays', 'Closed'],                      // [PLACEHOLDER]
  ],

  // Emergency numbers (national numbers, from public lists: confirm them before relying on them).
  hotlines: [
    ['National Emergency', '911'],
    ['Police (PNP)', '117'],
    ['Philippine Red Cross', '143'],
    ['Fire (BFP)', '(02) 8426-0219'],
    ['Disaster response (NDRRMC)', '(02) 8911-1406'],
  ],

  // Shown when the live numbers cannot be read (no internet, or no admin has opened the dashboard yet).
  // They are labelled "sample figures" on the page, so nobody mistakes them for real data.
  fallbackStats: { received: 128, resolved: 96, avgHours: 36 },

  // The live numbers are read from Firestore (public_stats/summary). These are your project's public web settings.
  firebase: { projectId: 'local-comm-bdae9', apiKey: 'AIzaSyB3Fi3H5ZlG1v_xBEPbm40RuUW-Xl6JX0g' },
};
