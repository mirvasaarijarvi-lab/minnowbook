import type { Language } from "@/i18n/translations";

/**
 * Support page FAQ and contact form wording in EN, FI and SV. Kept in its own
 * module so the long FAQ answers stay readable next to each other.
 */

export type FaqSection = { group: string; items: [string, string][] };

export interface SupportCopy {
  seoTitle: string;
  seoDescription: string;
  crumbHome: string;
  crumbSupport: string;
  faqHeading: string;
  faqIntro: string;
  faq: FaqSection[];
  form: {
    title: string;
    description: string;
    areas: Record<"dashboard" | "superadmin" | "generic", string>;
    subjectDashboard: string;
    subjectSuperadmin: string;
    subjectDefault: string;
    greeting: string;
    tryingToReach: string;
    area: string;
    describe: string;
    reportedRoute: string;
    name: string;
    optional: string;
    email: string;
    subject: string;
    message: string;
    sending: string;
    send: string;
    emailInstead: string;
    addressHidden: string;
    showAddress: string;
    challengeOptOut: string;
    sentFrom: string;
    errName: string;
    errEmailMissing: string;
    errEmailInvalid: string;
    errEmailLong: string;
    errSubjectShort: string;
    errSubjectLong: string;
    errMessageShort: string;
    errMessageLong: string;
    errCheckForm: string;
    tooFast: string;
    confirmPerson: string;
    wrongAnswer: string;
    rateTitle: string;
    rateDesc: string;
    sentTitle: string;
    sentDesc: string;
    openingMail: string;
    openingMailDesc: string;
    failTitle: string;
    failDesc: string;
  };
}

const en: SupportCopy = {
  seoTitle: "MimmoBook Support: Help Center & Knowledge Base",
  seoDescription:
    "Find answers to common questions about MimmoBook reservation management. Browse help articles on setup, bookings, email templates, team management and billing.",
  crumbHome: "Home",
  crumbSupport: "Support",
  faqHeading: "FAQ: Hotels, Multi-site overrides, and Kitchen Orders",
  faqIntro: "Quick answers about the newest MimmoBook features.",
  faq: [
    {
      group: "Hotels & room types",
      items: [
        [
          "How do I create many rooms at once?",
          "Open Resources, choose Hotel room as the type, and use Bulk create to generate a numbered sequence (e.g. 101 to 120). You can edit each room afterwards.",
        ],
        [
          "Can I price each room type differently?",
          "Yes. Pricing is set per room type, including weekday/weekend rates and per-night totals across multi-night stays.",
        ],
        [
          "How is breakfast handled?",
          "Breakfast is configured as an add-on with its own price; it is added to the nightly total when the guest selects it.",
        ],
        [
          "How do I take a room offline?",
          "Open the room and add an availability block for the dates it should be unavailable. Blocked dates are hidden from the public booking flow.",
        ],
        [
          "Why doesn't a room type appear for a date?",
          "Either every room of that type is booked or blocked, or the resource isn't active for the selected site. Check Availability and the site selector.",
        ],
      ],
    },
    {
      group: "Multi-site overrides (Business plan)",
      items: [
        [
          "How do I switch between sites?",
          "Use the site selector in the dashboard header. Your view, resources, and reservations are scoped to the active site.",
        ],
        [
          "What can I override per site?",
          "Opening hours, branding (logo, colors), email sender identity, and most booking settings. Anything not overridden falls back to the tenant defaults.",
        ],
        [
          "How do I reset a site to defaults?",
          "Open the site's settings page and click Reset to defaults on the relevant section. The site will inherit the tenant-level value again.",
        ],
        [
          "Can staff be limited to one site?",
          "Yes. Use site assignments to grant a user a role on specific sites only. They will only see those sites in the switcher.",
        ],
        [
          "Can I share a booking link for just one site?",
          "Yes. Generate a single-site booking link from the site's settings; the public flow locks to that site.",
        ],
        [
          "Is there a limit on sites?",
          "Multi-site is a Business plan feature. Tier limits apply to total sites; see Pricing for current limits.",
        ],
      ],
    },
    {
      group: "Kitchen Orders",
      items: [
        [
          "How does the Kitchen panel work?",
          "Open Kitchen from the dashboard to see live orders per reservation. Orders move through statuses: received to preparing to ready to served.",
        ],
        [
          "Which resources support kitchen orders?",
          "Restaurant, dine-in, catering, and pop-up resource types. Other resource types don't show the Kitchen tab.",
        ],
        [
          "How do I add items to an order?",
          "Open the reservation, go to Kitchen Order, and add items from the reusable kitchen menu or as free-text lines with quantity and notes.",
        ],
        [
          "Where do allergy notes appear?",
          "Allergy and guest notes are pinned to the top of the order card in the Kitchen panel so staff see them before preparing.",
        ],
        [
          "Can I reuse menu items?",
          "Yes. Manage a reusable kitchen menu under Settings; items can be added to any reservation with one click.",
        ],
        [
          "Who can see kitchen orders?",
          "Kitchen orders are kept separate for each site. Staff only see orders for sites they're assigned to.",
        ],
      ],
    },
  ],
  form: {
    title: "Contact support",
    description:
      "Send us a message and we'll reply by email. Response time is typically within one business day. We use your details only to answer your request.",
    areas: {
      dashboard: "Dashboard",
      superadmin: "Superadmin area",
      generic: "General",
    },
    subjectDashboard: "Help accessing my dashboard",
    subjectSuperadmin: "Help accessing the superadmin area",
    subjectDefault: "Support request",
    greeting: "Hi MimmoBook team,",
    tryingToReach: "I was trying to reach:",
    area: "Area:",
    describe: "Please describe what happened:",
    reportedRoute: "Reported page",
    name: "Your name",
    optional: "Optional",
    email: "Email *",
    subject: "Subject *",
    message: "Message *",
    sending: "Sending…",
    send: "Send to support",
    emailInstead: "Email instead",
    addressHidden: "Our support address is hidden from automated crawlers.",
    showAddress: "Show the address",
    challengeOptOut:
      'Prefer not to answer? Use "Email instead" below, your message still reaches us.',
    sentFrom: "Sent from",
    errName: "Name must be under 100 characters.",
    errEmailMissing: "Please add your email so we can reply.",
    errEmailInvalid: "Please check the email address.",
    errEmailLong: "Email must be under 255 characters.",
    errSubjectShort: "Please add a short subject.",
    errSubjectLong: "Subject must be under 150 characters.",
    errMessageShort: "Please describe your question in a bit more detail.",
    errMessageLong: "Message must be under 4000 characters.",
    errCheckForm: "Please check the form.",
    tooFast:
      "That was sent very quickly, so please answer this short question to confirm you are a person.",
    confirmPerson:
      "Please answer this short question to confirm you are a person.",
    wrongAnswer: "That answer did not match. Here is a new question.",
    rateTitle: "You have sent several messages already",
    rateDesc: "Please wait a few minutes before sending another one.",
    sentTitle: "Support request sent",
    sentDesc: "Our team will get back to you by email.",
    openingMail: "Opening your email app…",
    openingMailDesc: "If nothing happens, use the show address button below.",
    failTitle: "Couldn't send the request",
    failDesc: "Please try again in a moment.",
  },
};

const fi: SupportCopy = {
  seoTitle: "MimmoBook-tuki: Ohjekeskus ja tietopankki",
  seoDescription:
    "Löydä vastaukset yleisiin kysymyksiin MimmoBookin varausten hallinnasta. Selaa ohjeita käyttöönotosta, varauksista, sähköpostipohjista, tiimin hallinnasta ja laskutuksesta.",
  crumbHome: "Etusivu",
  crumbSupport: "Tuki",
  faqHeading:
    "UKK: Hotellit, toimipisteiden omat asetukset ja keittiötilaukset",
  faqIntro: "Nopeat vastaukset MimmoBookin uusimmista ominaisuuksista.",
  faq: [
    {
      group: "Hotellit ja huonetyypit",
      items: [
        [
          "Miten luon monta huonetta kerralla?",
          "Avaa Resurssit, valitse tyypiksi Hotellihuone ja luo numeroitu sarja (esim. 101 to 120) Luo useita -toiminnolla. Voit muokata jokaista huonetta jälkikäteen.",
        ],
        [
          "Voinko hinnoitella huonetyypit eri tavoin?",
          "Kyllä. Hinta asetetaan huonetyypeittäin, mukaan lukien arki- ja viikonloppuhinnat sekä usean yön majoitusten yökohtaiset summat.",
        ],
        [
          "Miten aamiainen hoidetaan?",
          "Aamiainen määritetään lisäpalveluksi omalla hinnallaan. Se lisätään yön hintaan, kun vieras valitsee sen.",
        ],
        [
          "Miten poistan huoneen käytöstä?",
          "Avaa huone ja lisää saatavuuden esto niille päiville, jolloin huone ei ole käytettävissä. Estettyjä päiviä ei näytetä julkisessa varauksessa.",
        ],
        [
          "Miksi huonetyyppi ei näy tietylle päivälle?",
          "Joko kaikki kyseisen tyypin huoneet on varattu tai estetty, tai resurssi ei ole käytössä valitussa toimipisteessä. Tarkista Saatavuus ja toimipisteen valinta.",
        ],
      ],
    },
    {
      group: "Toimipisteiden omat asetukset (Business-paketti)",
      items: [
        [
          "Miten vaihdan toimipisteestä toiseen?",
          "Käytä hallintapaneelin yläosan toimipistevalitsinta. Näkymä, resurssit ja varaukset rajautuvat valittuun toimipisteeseen.",
        ],
        [
          "Mitä voin asettaa toimipistekohtaisesti?",
          "Aukioloajat, ulkoasun (logo, värit), sähköpostin lähettäjätiedot ja useimmat varausasetukset. Kaikki, mitä ei ole asetettu erikseen, tulee yrityksen oletuksista.",
        ],
        [
          "Miten palautan toimipisteen oletusasetuksiin?",
          "Avaa toimipisteen asetukset ja valitse kyseisestä osiosta Palauta oletukset. Toimipiste käyttää taas yrityksen yhteistä asetusta.",
        ],
        [
          "Voiko henkilökunnan rajata yhteen toimipisteeseen?",
          "Kyllä. Toimipistekohtaisilla oikeuksilla käyttäjälle annetaan rooli vain tiettyihin toimipisteisiin. Hän näkee valitsimessa vain ne.",
        ],
        [
          "Voinko jakaa varauslinkin vain yhteen toimipisteeseen?",
          "Kyllä. Luo toimipisteen asetuksista yhden toimipisteen varauslinkki. Julkinen varaus pysyy silloin siinä toimipisteessä.",
        ],
        [
          "Onko toimipisteiden määrällä rajaa?",
          "Useat toimipisteet ovat Business-paketin ominaisuus. Pakettien rajat koskevat toimipisteiden kokonaismäärää. Katso ajantasaiset rajat Hinnoittelu-sivulta.",
        ],
      ],
    },
    {
      group: "Keittiötilaukset",
      items: [
        [
          "Miten Keittiö-näkymä toimii?",
          "Avaa Keittiö hallintapaneelista nähdäksesi varauskohtaiset tilaukset reaaliajassa. Tilaukset etenevät tiloissa: vastaanotettu, valmistuksessa, valmis ja tarjoiltu.",
        ],
        [
          "Mitkä resurssit tukevat keittiötilauksia?",
          "Ravintola-, pöytävaraus-, catering- ja pop up -resurssit. Muilla resurssityypeillä ei näy Keittiö-välilehteä.",
        ],
        [
          "Miten lisään tuotteita tilaukseen?",
          "Avaa varaus, siirry kohtaan Keittiötilaus ja lisää tuotteita keittiön vakiomenusta tai vapaina riveinä määrän ja lisätietojen kanssa.",
        ],
        [
          "Missä allergiatiedot näkyvät?",
          "Allergia- ja vierasmerkinnät näkyvät Keittiö-näkymässä tilauskortin ylälaidassa, joten henkilökunta näkee ne ennen valmistusta.",
        ],
        [
          "Voinko käyttää menun tuotteita uudelleen?",
          "Kyllä. Hallitse keittiön vakiomenua Asetuksissa. Tuotteet lisätään mihin tahansa varaukseen yhdellä napsautuksella.",
        ],
        [
          "Kuka näkee keittiötilaukset?",
          "Keittiötilaukset pidetään erillään toimipisteittäin. Henkilökunta näkee vain niiden toimipisteiden tilaukset, joihin heidät on liitetty.",
        ],
      ],
    },
  ],
  form: {
    title: "Ota yhteyttä tukeen",
    description:
      "Lähetä meille viesti, niin vastaamme sähköpostitse. Vastaamme yleensä yhden arkipäivän kuluessa. Käytämme tietojasi vain pyyntösi käsittelyyn.",
    areas: {
      dashboard: "Hallintapaneeli",
      superadmin: "Pääkäyttäjän alue",
      generic: "Yleinen",
    },
    subjectDashboard: "Apua hallintapaneeliin pääsyssä",
    subjectSuperadmin: "Apua pääkäyttäjän alueelle pääsyssä",
    subjectDefault: "Tukipyyntö",
    greeting: "Hei MimmoBook-tiimi,",
    tryingToReach: "Yritin avata sivun:",
    area: "Alue:",
    describe: "Kerro, mitä tapahtui:",
    reportedRoute: "Ilmoitettu sivu",
    name: "Nimesi",
    optional: "Vapaaehtoinen",
    email: "Sähköposti *",
    subject: "Aihe *",
    message: "Viesti *",
    sending: "Lähetetään…",
    send: "Lähetä tukeen",
    emailInstead: "Lähetä sähköpostilla",
    addressHidden: "Tukiosoitteemme on piilotettu automaattisilta keräimiltä.",
    showAddress: "Näytä osoite",
    challengeOptOut:
      "Etkö halua vastata? Käytä alla olevaa Lähetä sähköpostilla -painiketta, viestisi tulee silti perille.",
    sentFrom: "Lähetetty sivulta",
    errName: "Nimen on oltava alle 100 merkkiä.",
    errEmailMissing: "Lisää sähköpostiosoitteesi, jotta voimme vastata.",
    errEmailInvalid: "Tarkista sähköpostiosoite.",
    errEmailLong: "Sähköpostiosoitteen on oltava alle 255 merkkiä.",
    errSubjectShort: "Lisää lyhyt aihe.",
    errSubjectLong: "Aiheen on oltava alle 150 merkkiä.",
    errMessageShort: "Kerro kysymyksestäsi hieman tarkemmin.",
    errMessageLong: "Viestin on oltava alle 4000 merkkiä.",
    errCheckForm: "Tarkista lomake.",
    tooFast:
      "Viesti lähti hyvin nopeasti, joten vastaa tähän lyhyeen kysymykseen vahvistaaksesi, että olet ihminen.",
    confirmPerson:
      "Vastaa tähän lyhyeen kysymykseen vahvistaaksesi, että olet ihminen.",
    wrongAnswer: "Vastaus ei täsmännyt. Tässä uusi kysymys.",
    rateTitle: "Olet jo lähettänyt useita viestejä",
    rateDesc: "Odota muutama minuutti ennen seuraavaa viestiä.",
    sentTitle: "Tukipyyntö lähetetty",
    sentDesc: "Tiimimme vastaa sinulle sähköpostitse.",
    openingMail: "Avataan sähköpostiohjelmaa…",
    openingMailDesc:
      "Jos mitään ei tapahdu, käytä alla olevaa Näytä osoite -painiketta.",
    failTitle: "Pyyntöä ei voitu lähettää",
    failDesc: "Yritä hetken kuluttua uudelleen.",
  },
};

const sv: SupportCopy = {
  seoTitle: "MimmoBook support: Hjälpcenter och kunskapsbas",
  seoDescription:
    "Hitta svar på vanliga frågor om bokningshantering i MimmoBook. Bläddra bland hjälpartiklar om kom igång, bokningar, e-postmallar, teamhantering och fakturering.",
  crumbHome: "Hem",
  crumbSupport: "Support",
  faqHeading:
    "Vanliga frågor: Hotell, egna inställningar per plats och köksbeställningar",
  faqIntro: "Snabba svar om MimmoBooks nyaste funktioner.",
  faq: [
    {
      group: "Hotell och rumstyper",
      items: [
        [
          "Hur skapar jag många rum på en gång?",
          "Öppna Resurser, välj Hotellrum som typ och använd Skapa flera för att skapa en numrerad serie (t.ex. 101 to 120). Du kan redigera varje rum efteråt.",
        ],
        [
          "Kan jag prissätta varje rumstyp olika?",
          "Ja. Priset sätts per rumstyp, inklusive vardags- och helgpriser och summor per natt för vistelser över flera nätter.",
        ],
        [
          "Hur hanteras frukost?",
          "Frukost ställs in som ett tillval med eget pris. Det läggs till nattpriset när gästen väljer det.",
        ],
        [
          "Hur tar jag ett rum ur bruk?",
          "Öppna rummet och lägg till en spärr för de datum då det inte ska gå att boka. Spärrade datum visas inte i den publika bokningen.",
        ],
        [
          "Varför visas inte en rumstyp för ett datum?",
          "Antingen är alla rum av den typen bokade eller spärrade, eller så är resursen inte aktiv på den valda platsen. Kontrollera Tillgänglighet och platsväljaren.",
        ],
      ],
    },
    {
      group: "Egna inställningar per plats (Business-paketet)",
      items: [
        [
          "Hur byter jag mellan platser?",
          "Använd platsväljaren i instrumentpanelens sidhuvud. Vy, resurser och bokningar begränsas till den valda platsen.",
        ],
        [
          "Vad kan jag ställa in per plats?",
          "Öppettider, utseende (logotyp, färger), e-postavsändare och de flesta bokningsinställningar. Allt som inte ställts in separat hämtas från företagets standardvärden.",
        ],
        [
          "Hur återställer jag en plats till standard?",
          "Öppna platsens inställningar och välj Återställ standard i det aktuella avsnittet. Platsen använder då företagets gemensamma värde igen.",
        ],
        [
          "Kan personal begränsas till en plats?",
          "Ja. Med platsbehörigheter får användaren en roll endast på vissa platser. Hen ser då bara de platserna i väljaren.",
        ],
        [
          "Kan jag dela en bokningslänk för bara en plats?",
          "Ja. Skapa en bokningslänk för en plats i platsens inställningar. Den publika bokningen låses då till den platsen.",
        ],
        [
          "Finns det en gräns för antalet platser?",
          "Flera platser är en funktion i Business-paketet. Paketets gränser gäller det totala antalet platser. Se Priser för aktuella gränser.",
        ],
      ],
    },
    {
      group: "Köksbeställningar",
      items: [
        [
          "Hur fungerar Kök-vyn?",
          "Öppna Kök från instrumentpanelen för att se beställningar per bokning i realtid. Beställningarna går igenom stegen mottagen, tillagas, klar och serverad.",
        ],
        [
          "Vilka resurser stöder köksbeställningar?",
          "Restaurang, bordsbokning, catering och pop up. Andra resurstyper visar inte fliken Kök.",
        ],
        [
          "Hur lägger jag till artiklar i en beställning?",
          "Öppna bokningen, gå till Köksbeställning och lägg till artiklar från den återanvändbara köksmenyn eller som fria rader med antal och anteckningar.",
        ],
        [
          "Var visas allergianteckningar?",
          "Allergi- och gästanteckningar visas överst på beställningskortet i Kök-vyn, så att personalen ser dem innan tillagningen.",
        ],
        [
          "Kan jag återanvända menyartiklar?",
          "Ja. Hantera en återanvändbar köksmeny under Inställningar. Artiklar läggs till i valfri bokning med ett klick.",
        ],
        [
          "Vem kan se köksbeställningar?",
          "Köksbeställningar hålls åtskilda per plats. Personalen ser bara beställningar för de platser de är kopplade till.",
        ],
      ],
    },
  ],
  form: {
    title: "Kontakta support",
    description:
      "Skicka ett meddelande så svarar vi via e-post. Vi svarar oftast inom en arbetsdag. Vi använder dina uppgifter endast för att besvara din förfrågan.",
    areas: {
      dashboard: "Instrumentpanel",
      superadmin: "Superadministratörens område",
      generic: "Allmänt",
    },
    subjectDashboard: "Hjälp att komma åt min instrumentpanel",
    subjectSuperadmin: "Hjälp att komma åt superadministratörens område",
    subjectDefault: "Supportärende",
    greeting: "Hej MimmoBook-teamet,",
    tryingToReach: "Jag försökte öppna sidan:",
    area: "Område:",
    describe: "Beskriv vad som hände:",
    reportedRoute: "Rapporterad sida",
    name: "Ditt namn",
    optional: "Valfritt",
    email: "E-post *",
    subject: "Ämne *",
    message: "Meddelande *",
    sending: "Skickar…",
    send: "Skicka till support",
    emailInstead: "Skicka via e-post",
    addressHidden: "Vår supportadress är dold för automatiska insamlare.",
    showAddress: "Visa adressen",
    challengeOptOut:
      "Vill du hellre inte svara? Använd Skicka via e-post nedan, ditt meddelande når oss ändå.",
    sentFrom: "Skickat från",
    errName: "Namnet måste vara kortare än 100 tecken.",
    errEmailMissing: "Lägg till din e-postadress så att vi kan svara.",
    errEmailInvalid: "Kontrollera e-postadressen.",
    errEmailLong: "E-postadressen måste vara kortare än 255 tecken.",
    errSubjectShort: "Lägg till ett kort ämne.",
    errSubjectLong: "Ämnet måste vara kortare än 150 tecken.",
    errMessageShort: "Beskriv din fråga lite mer detaljerat.",
    errMessageLong: "Meddelandet måste vara kortare än 4000 tecken.",
    errCheckForm: "Kontrollera formuläret.",
    tooFast:
      "Det skickades mycket snabbt, så svara på den här korta frågan för att bekräfta att du är en människa.",
    confirmPerson:
      "Svara på den här korta frågan för att bekräfta att du är en människa.",
    wrongAnswer: "Svaret stämde inte. Här är en ny fråga.",
    rateTitle: "Du har redan skickat flera meddelanden",
    rateDesc: "Vänta några minuter innan du skickar ett till.",
    sentTitle: "Supportärendet har skickats",
    sentDesc: "Vårt team svarar dig via e-post.",
    openingMail: "Öppnar ditt e-postprogram…",
    openingMailDesc: "Om inget händer, använd knappen Visa adressen nedan.",
    failTitle: "Ärendet kunde inte skickas",
    failDesc: "Försök igen om en stund.",
  },
};

export const SUPPORT_COPY: Record<Language, SupportCopy> = { en, fi, sv };

export const getSupportCopy = (language: Language): SupportCopy =>
  SUPPORT_COPY[language] ?? en;
