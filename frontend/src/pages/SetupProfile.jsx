import React, { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const T = {
  navy:       "#1e3a5f",
  navyDark:   "#162d4a",
  navyBg:     "#254370",
  blue:       "#2563eb",
  blueDark:   "#1d4ed8",
  blueLight:  "#eff6ff",
  teal:       "#0891b2",
  green:      "#16a34a",
  red:        "#dc2626",
  slate:      "#475569",
  slateLight: "#94a3b8",
  border:     "#e2e8f0",
  bg:         "#f8fafc",
  white:      "#ffffff",
  text:       "#1e293b",
  textMuted:  "#64748b",
};

const font = "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif";

const Label = ({ children, required }) => (
  <label style={{
    display: "block", fontSize: "0.72rem", fontWeight: 700, color: T.slate,
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, fontFamily: font,
  }}>
    {children}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
  </label>
);

const inputBase = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: `1.5px solid ${T.border}`, fontSize: "0.9rem", fontFamily: font,
  color: T.text, background: T.white, boxSizing: "border-box", outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
};

const Input = (props) => (
  <input
    {...props}
    style={{ ...inputBase, ...props.style }}
    onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
  />
);

const Select = (props) => (
  <select
    {...props}
    style={{ ...inputBase, appearance: "auto", ...props.style }}
    onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
  />
);

const SectionHeader = ({ icon, title }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    margin: "28px 0 18px", paddingBottom: 12, borderBottom: `2px solid ${T.border}`,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8, background: `${T.navy}15`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
    }}>{icon}</div>
    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: T.navy, fontFamily: font, letterSpacing: "0.01em" }}>{title}</span>
  </div>
);

// ✅ FIX: Avoids React "mixing shorthand and non-shorthand border" warning
const prefixBorderStyle = (color) => ({
  borderTop:    `1.5px solid ${color}`,
  borderLeft:   `1.5px solid ${color}`,
  borderBottom: `1.5px solid ${color}`,
  borderRight:  "none",
});

function SetupProfile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [form, setForm] = useState({
    fullName: user?.name || "", email: user?.email || "",
    studentId: "", sex: "", birthdate: "", department: "",
    yearLevel: "", section: "", phone: "",
    street: "", barangay: "", city: "", province: "",
    emergencyName: "", emergencyPhone: "",
  });

  const [profilePic, setProfilePic]               = useState(null);
  const [preview, setPreview]                     = useState(null);
  const [errorMessage, setErrorMessage]           = useState("");
  const [loading, setLoading]                     = useState(false);
  const [phoneTouched, setPhoneTouched]           = useState(false);
  const [emergPhoneTouched, setEmergPhoneTouched] = useState(false);
  const [showCamera, setShowCamera]               = useState(false);
  const [cameraStream, setCameraStream]           = useState(null);
  const [cameraError, setCameraError]             = useState("");
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhone = (field) => (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm(f => ({ ...f, [field]: digits }));
  };

  const hasWrongPrefix = (val) => val.length >= 2 && !val.startsWith("9");

  const phoneStatus = (val, touched) => {
    if (!val && !touched) return "empty";
    if (!val && touched)  return "error";
    if (val.length > 0 && val.length < 10) return "incomplete";
    if (hasWrongPrefix(val))               return "wrong_prefix";
    if (isValidPhone(val))                 return "valid";
    return "error";
  };

  const phoneBorderColor = (status) => {
    if (status === "valid")      return T.green;
    if (status === "incomplete") return "#f59e0b";
    if (status === "error" || status === "wrong_prefix") return T.red;
    return T.border;
  };

  const phoneBoxShadow = (status) => {
    if (status === "valid")      return "0 0 0 3px #dcfce7";
    if (status === "incomplete") return "0 0 0 3px #fef3c7";
    if (status === "error" || status === "wrong_prefix") return "0 0 0 3px #fee2e2";
    return "none";
  };

  const isValidPhone = (val) => val.length === 10 && val.startsWith("9");

  const toStoredPhone = (val) => {
    const digits = val.replace(/\D/g, "");
    if (digits.startsWith("09")) return digits.slice(0, 11);
    if (digits.startsWith("9"))  return "0" + digits.slice(0, 10);
    return digits;
  };

  const PROVINCES = [
    "Metro Manila","Abra","Agusan del Norte","Agusan del Sur","Aklan","Albay","Antique",
    "Apayao","Aurora","Basilan","Bataan","Batanes","Batangas","Benguet","Biliran",
    "Bohol","Bukidnon","Bulacan","Cagayan","Camarines Norte","Camarines Sur","Camiguin",
    "Capiz","Catanduanes","Cavite","Cebu","Compostela Valley","Cotabato","Davao del Norte",
    "Davao del Sur","Davao Occidental","Davao Oriental","Dinagat Islands","Eastern Samar",
    "Guimaras","Ifugao","Ilocos Norte","Ilocos Sur","Iloilo","Isabela","Kalinga",
    "La Union","Laguna","Lanao del Norte","Lanao del Sur","Leyte","Maguindanao","Marinduque",
    "Masbate","Misamis Occidental","Misamis Oriental","Mountain Province","Negros Occidental",
    "Negros Oriental","Northern Samar","Nueva Ecija","Nueva Vizcaya","Occidental Mindoro",
    "Oriental Mindoro","Palawan","Pampanga","Pangasinan","Quezon","Quirino","Rizal",
    "Romblon","Samar","Sarangani","Siquijor","Sorsogon","South Cotabato","Southern Leyte",
    "Sultan Kudarat","Sulu","Surigao del Norte","Surigao del Sur","Tarlac","Tawi-Tawi",
    "Zambales","Zamboanga del Norte","Zamboanga del Sur","Zamboanga Sibugay",
  ];

  const CITIES_BY_PROVINCE = {
    "Metro Manila": ["Caloocan","Las Piñas","Makati","Malabon","Mandaluyong","Manila","Marikina","Muntinlupa","Navotas","Parañaque","Pasay","Pasig","Pateros","Quezon City","San Juan","Taguig","Valenzuela"],
    "Batangas": ["Agoncillo","Alitagtag","Balayan","Balete","Batangas City","Bauan","Calaca","Calatagan","Cuenca","Ibaan","Laurel","Lemery","Lian","Lipa City","Lobo","Mabini","Malvar","Mataasnakahoy","Nasugbu","Padre Garcia","Rosario","San Jose","San Juan","San Luis","San Nicolas","San Pascual","Santa Teresita","Santo Tomas","Taal","Talisay","Tanauan City","Taysan","Tingloy","Tuy"],
    "Cavite": ["Alfonso","Amadeo","Bacoor","Carmona","Cavite City","Dasmariñas","General Emilio Aguinaldo","General Mariano Alvarez","General Trias","Imus","Indang","Kawit","Magallanes","Maragondon","Mendez","Naic","Noveleta","Rosario","Silang","Tagaytay","Tanza","Ternate","Trece Martires"],
    "Laguna": ["Alaminos","Bay","Biñan","Cabuyao","Calamba","Calauan","Cavinti","Famy","Kalayaan","Liliw","Los Baños","Luisiana","Lumban","Mabitac","Magdalena","Majayjay","Nagcarlan","Paete","Pagsanjan","Pakil","Pangil","Pila","Rizal","San Pablo","San Pedro","Santa Cruz","Santa Maria","Santa Rosa","Siniloan","Victoria"],
    "Cebu": ["Alcantara","Alcoy","Alegria","Aloguinsan","Argao","Asturias","Badian","Balamban","Bantayan","Barili","Bogo","Boljoon","Borbon","Carcar","Carmen","Catmon","Cebu City","Compostela","Consolacion","Cordova","Daanbantayan","Dalaguete","Danao","Dumanjug","Ginatilan","Lapu-Lapu","Liloan","Madridejos","Malabuyoc","Mandaue","Medellin","Minglanilla","Moalboal","Naga","Oslob","Pilar","Pinamungahan","Poro","Ronda","Samboan","San Fernando","San Francisco","San Remigio","Santa Fe","Santander","Sibonga","Sogod","Tabogon","Tabuelan","Talisay","Toledo","Tuburan","Tudela"],
    "Davao del Sur": ["Bansalan","Davao City","Digos","Hagonoy","Jose Abad Santos","Kiblawan","Magsaysay","Malalag","Malita","Matanao","Padada","Santa Cruz","Sulop"],
    "Iloilo": ["Ajuy","Alimodian","Anilao","Badiangan","Balasan","Banate","Barotac Nuevo","Barotac Viejo","Batad","Bingawan","Cabatuan","Calinog","Carles","Concepcion","Dingle","Dueñas","Dumangas","Estancia","Guimbal","Igbaras","Iloilo City","Janiuay","Lambunao","Leganes","Lemery","Leon","Maasin","Miagao","Mina","New Lucena","Oton","Passi","Pavia","Pototan","San Dionisio","San Enrique","San Joaquin","San Miguel","San Rafael","Santa Barbara","Sara","Tigbauan","Tubungan","Zarraga"],
    "Pampanga": ["Angeles","Apalit","Arayat","Bacolor","Candaba","Floridablanca","Guagua","Lubao","Mabalacat","Macabebe","Magalang","Masantol","Mexico","Minalin","Porac","San Fernando","San Luis","San Simon","Santa Ana","Santa Rita","Santo Tomas","Sasmuan"],
    "Bulacan": ["Angat","Balagtas","Baliuag","Bocaue","Bulakan","Bustos","Calumpit","Doña Remedios Trinidad","Guiguinto","Hagonoy","Malolos","Marilao","Meycauayan","Norzagaray","Obando","Pandi","Plaridel","Pulilan","San Ildefonso","San Jose del Monte","San Miguel","San Rafael","Santa Maria"],
    "Rizal": ["Angono","Antipolo","Baras","Binangonan","Cainta","Cardona","Jala-Jala","Morong","Pililla","Rodriguez","San Mateo","Tanay","Taytay","Teresa"],
    "Negros Occidental": ["Bacolod","Bago","Binalbagan","Cadiz","Calatrava","Candoni","Cauayan","Enrique B. Magalona","Escalante","Himamaylan","Hinigaran","Hinoba-an","Ilog","Isabela","Kabankalan","La Carlota","La Castellana","Manapla","Moises Padilla","Murcia","Pontevedra","Pulupandan","Sagay","Salvador Benedicto","San Carlos","San Enrique","Silay","Sipalay","Toboso","Valladolid","Victorias"],
    "Albay": ["Bacacay","Camalig","Daraga","Guinobatan","Jovellar","Legazpi","Libon","Ligao","Malilipot","Malinao","Manito","Oas","Pio Duran","Polangui","Rapu-Rapu","Santo Domingo","Tabaco","Tiwi"],
    "Pangasinan": ["Agno","Aguilar","Alaminos","Alcala","Anda","Asingan","Balungao","Bani","Basista","Bautista","Bayambang","Binalonan","Binmaley","Bolinao","Bugallon","Burgos","Calasiao","Dagupan","Dasol","Infanta","Labrador","Laoac","Lingayen","Mabini","Malasiqui","Manaoag","Mangaldan","Mangatarem","Mapandan","Natividad","Pozorrubio","Rosales","San Carlos","San Fabian","San Jacinto","San Manuel","San Nicolas","San Quintin","Santa Barbara","Santa Maria","Santo Tomas","Sison","Sual","Tayug","Umingan","Urbiztondo","Urdaneta","Villasis"],
    "Bohol": ["Alburquerque","Alicia","Anda","Antequera","Baclayon","Balilihan","Batuan","Bien Unido","Bilar","Buenavista","Calape","Candijay","Carmen","Catigbian","Clarin","Corella","Cortes","Dagohoy","Danao","Dauis","Dimiao","Duero","Garcia Hernandez","Getafe","Guindulman","Inabanga","Jagna","Lila","Loay","Loboc","Loon","Mabini","Maribojoc","Panglao","Pilar","President Carlos P. Garcia","Sagbayan","San Isidro","San Miguel","Sevilla","Sierra Bullones","Sikatuna","Tagbilaran","Talibon","Trinidad","Tubigon","Ubay","Valencia"],
    "Leyte": ["Abuyog","Alangalang","Albuera","Babatngon","Barugo","Bato","Baybay","Burauen","Calubian","Capoocan","Carigara","Dagami","Dulag","Hilongos","Hindang","Inopacan","Isabel","Jaro","Javier","Julita","Kananga","La Paz","Leyte","Liloan","Macarthur","Mahaplag","Matag-ob","Matalom","Mayorga","Merida","Naval","Ormoc","Palo","Palompon","Pastrana","San Isidro","San Miguel","Santa Fe","Tabango","Tabontabon","Tacloban","Tanauan","Tolosa","Tunga","Villaba"],
    "Quezon": ["Agdangan","Alabat","Atimonan","Buenavista","Burdeos","Calauag","Candelaria","Catanauan","Dolores","General Luna","General Nakar","Guinayangan","Gumaca","Infanta","Jomalig","Lopez","Lucban","Lucena","Macalelon","Mauban","Mulanay","Padre Burgos","Pagbilao","Panukulan","Patnanungan","Perez","Pitogo","Plaridel","Polillo","Quezon","Real","Sampaloc","San Andres","San Antonio","San Francisco","San Narciso","Sariaya","Tagkawayan","Tiaong","Unisan"],
    "Nueva Ecija": ["Aliaga","Bongabon","Cabanatuan","Cabiao","Carranglan","Cuyapo","Gabaldon","Gapan","General Mamerto Natividad","General Tinio","Guimba","Jaen","Laur","Licab","Llanera","Lupao","Nampicuan","Palayan","Pantabangan","Peñaranda","Quezon","Rizal","San Antonio","San Isidro","San Jose","San Leonardo","Santa Rosa","Santo Domingo","Talavera","Talugtug","Zaragoza"],
  };

  const BARANGAYS_BY_CITY = {
    "Caloocan": ["Bagong Silang","Baesa","Bagumbong","Camarin","Deparo","Llano","Maypajo","Monumento","Novaliches","Pangarap","Sangandaan","Tala"],
    "Las Piñas": ["Almanza Uno","Almanza Dos","B.F. Homes","Bambang","Casimiro","Daniel Fajardo","Elias Aldana","Ilaya","Manuyo Uno","Manuyo Dos","Pamplona Uno","Pamplona Dos","Pamplona Tres","Pilar","Pulang Lupa Uno","Pulang Lupa Dos","Talon Uno","Talon Dos","Talon Tres","Talon Kuatro","Talon Singko","Zapote"],
    "Makati": ["Bangkal","Bel-Air","Carmona","Comembo","East Rembo","Forbes Park","Guadalupe Nuevo","Guadalupe Viejo","Kasilawan","La Paz","Magallanes","Olympia","Palanan","Pembo","Pinagkaisahan","Pio Del Pilar","Pitogo","Poblacion","Post Proper Northside","Post Proper Southside","Rizal","San Antonio","San Isidro","San Lorenzo","Santa Cruz","Singkamas","South Cembo","Tejeros","Urdaneta","Valenzuela","West Rembo"],
    "Malabon": ["Acero","Agerico","Assumption","Baritan","Bayan-bayanan","Catmon","Concepcion","Dampalit","Flores","Hulong Duhat","Ibaba","Longos","Maysilo","Muzon","Niugan","Panghulo","Potrero","San Agustin","Santolan","Tañong","Tinajeros","Tonsuya","Tugatog"],
    "Mandaluyong": ["Addition Hills","Bagong Silang","Barangka Drive","Barangka Ibaba","Barangka Itaas","Barangka Ilaya","Buayang Bato","Burol","Daang Bakal","Hagdan Bato Itaas","Hagdan Bato Libis","Harapin Ang Bukas","Highway Hills","Hulo","Ilang-Ilang","Mabini-J. Rizal","Malamig","Mauway","Namayan","New Zañiga","Old Zañiga","Pag-asa","Plainview","Pleasant Hills","Poblacion","San Joaquin","Vergara","Wack-Wack Greenhills"],
    "Manila": ["Binondo","Ermita","Intramuros","Malate","Paco","Pandacan","Port Area","Quiapo","Sampaloc","San Andres","San Miguel","San Nicolas","Santa Ana","Santa Cruz","Santa Mesa","Tondo"],
    "Marikina": ["Barangka","Calumpang","Concepcion Uno","Concepcion Dos","Fortune","Industrial Valley","Jesus dela Peña","Kapasigan","Malanday","Nangka","Parang","San Roque","Santa Elena","Sto. Niño","Tañong","Tumana"],
    "Muntinlupa": ["Alabang","Ayala Alabang","Bayanan","Buli","Cupang","Poblacion","Putatan","Sucat","Tunasan"],
    "Navotas": ["Bagumbayan North","Bagumbayan South","Bangculasi","Daanghari","Navotas East","Navotas West","North Bay Boulevard North","North Bay Boulevard South","San Jose","San Raphael","San Roque","Sipac-Almacen","Tangos"],
    "Parañaque": ["BF Homes","Don Bosco","Don Galo","La Huerta","Marcelo Green","Merville","Moonshine","San Antonio","San Dionisio","San Isidro","San Martin de Porres","Santo Niño","Sun Valley","Tambo","Vitalez"],
    "Pasay": ["Baclaran","Don Bosco","Libertad","Malibay","Maricaban","Pio del Pilar","Quirino","San Jose","San Rafael","Santo Niño","Villamor"],
    "Pasig": ["Bagong Ilog","Bagong Katipunan","Bambang","Buting","Caniogan","Dela Paz","Kalawaan","Kapasigan","Kapitolyo","Malinao","Manggahan","Maybunga","Oranbo","Palatiw","Pinagbuhatan","Pineda","Rosario","Sagad","San Antonio","San Joaquin","San Jose","San Nicolas","Santa Cruz","Santa Lucia","Santa Rosa","Santo Tomas","Santolan","Sumilang","Ugong"],
    "Quezon City": ["Alicia","Bagbag","Bagong Pag-asa","Bagong Silangan","Bagumbayan","Bahay Toro","Balingasa","Balonbato","Batasan Hills","Bayanihan","Blue Ridge A","Blue Ridge B","Botocan","Bungad","Capitol","Central","Commonwealth","Culiat","Damayang Lagi","Del Monte","Diliman","Don Manuel","Doña Aurora","Doña Imelda","E. Rodriguez","East Kamias","Fairview","Greater Lagro","Gulod","Holy Spirit","Horseshoe","Immaculate Concepcion","Kaligayahan","Kalusugan","Kamuning","Katipunan","Kaunlaran","La Loma","Laging Handa","Libis","Lourdes","Loyola Heights","Maharlika","Malaya","Manresa","Mariana","Mariblo","Masambong","Matandang Balara","Milagrosa","Nagkaisang Nayon","New Era","North Fairview","Novaliches Proper","Obrero","Old Capitol Site","Paang Bundok","Pag-ibig sa Nayon","Paligsahan","Paltok","Pansol","Pasong Putik","Phil-Am","Pinagkaisahan","Project 6","Quirino 2-A","Quirino 2-B","Quirino 2-C","Quirino 3-A","Ramon Magsaysay","Roxas","Sacred Heart","Saint Ignatius","Saint Peter","Salvacion","San Agustin","San Antonio","San Bartolome","San Isidro Labrador","San Jose","San Martin de Porres","San Roque","Sangandaan","Santa Cruz","Santa Lucia","Santa Monica","Santo Cristo","Santo Domingo","Santo Niño","Silangan","South Triangle","Tagumpay","Talayan","Teachers Village East","Teachers Village West","Ugong Norte","Vasra","Veterans Village","Vista Real","West Kamias","West Triangle","White Plains"],
    "San Juan": ["Addition Hills","Balong Bato","Batis","Corazon de Jesus","Ermitaño","Greenhills","Isabelita","Kabayanan","Little Baguio","Maytunas","Onse","Pasadena","Pedro Cruz","Progreso","Rivera","Salapan","San Perfecto","Santa Lucia","Tibagan","West Crame"],
    "Taguig": ["Bagumbayan","Bambang","Calzada","Central Bicutan","Central Signal Village","Fort Bonifacio","Hagonoy","Ibayo Tipas","Katuparan","Ligid Tipas","Lower Bicutan","Maharlika Village","Napindan","New Lower Bicutan","North Daang Hari","North Signal Village","Palingon","Pinagsama","South Daang Hari","South Signal Village","Tanyag","Tuktukan","Upper Bicutan","Ususan","Wawa","West Bicutan","Western Bicutan"],
    "Valenzuela": ["Arkong Bato","Bagbaguin","Balangkas","Bignay","Bisig","Canumay East","Canumay West","Coloong","Dalandanan","Gen. T. de Leon","Isla","Karuhatan","Lawang Bato","Lingunan","Mabolo","Malanday","Malinta","Mapulang Lupa","Marulas","Maysan","Palasan","Parada","Pariancillo Villa","Pasolo","Poblacion","Polo","Punturin","Rincon","Tagalag","Ugong","Wawang Pulo"],
    "Batangas City": ["Alangilan","Balagtas","Balete","Banaba Center","Banaba Ibaba","Banaba Kanluran","Banaba Silangan","Bolbok","Bukal","Calicanto","Cuta","Dalig","Dela Paz","Domocol","Dozones","Dumantay","Dumuclay","Ilijan","Kumintang Ibaba","Kumintang Ilaya","Libjo","Liponpon","Maapas","Makiling","Malibay","Malitam","Matoco","Munting Tubig","Pagkilatan","Paharang Kanluran","Paharang Silangan","Pallocan Kanluran","Pallocan Silangan","Pinamucan","Pinamucan Ibaba","Pinamucan Silangan","Poblacion","Pulang Lupa","Sampaga","San Agapito","San Agustin Kanluran","San Agustin Silangan","San Andres","San Antonio","San Isidro","San Jose Sico","San Miguel","San Pedro","Santa Clara","Santa Rita Aplaya","Santa Rita Karsada","Santo Domingo","Santo Niño","Santo Tomas","Simlong","Sirang Lupa","Sorosoro Ibaba","Sorosoro Ilaya","Sorosoro Karsada","Tabangao Aplaya","Tabangao Dao","Tabangao-Ambulong","Talahib Pandayan","Talahib Payapa","Talumpok Kanluran","Talumpok Silangan","Tingga Ibaba","Tingga Itaas","Tulo","Wawa"],
    "Lipa City": ["Anilao","Anilao-Labac","Antipolo del Norte","Antipolo del Sur","Bagong Pook","Balintawak","Banaybanay","Bolbok","Bugtong na Pulo","Bulacnin","Bulaklak","Calamias","Cumba","Dagatan","Duhatan","Haligue Kanluran","Haligue Silangan","Inosloban","Kayumanggi","Latag","Libjo","Lipa City Proper","Lodlod","Lumbang","Mabini","Malagonlong","Malitlit","Marauoy","Mataas na Lupa","Munting Pulo","Pagolingin Bata","Pagolingin East","Pagolingin West","Pangao","Pinagkawitan","Pinagtongulan","Plaridel","Poblacion Barangay 1","Poblacion Barangay 2","Poblacion Barangay 3","Poblacion Barangay 4","Poblacion Barangay 5","Poblacion Barangay 6","Poblacion Barangay 7","Poblacion Barangay 8","Poblacion Barangay 9","Poblacion Barangay 10","Pusil","Quezon","Sabang","Sampaguita","San Benito","San Carlos","San Celestino","San Francisco","San Guillermo","San Jose","San Lucas","San Salvador","San Sebastian","Santiago","Santol","Sirang Lupa","Soro-soro Ibaba","Soro-soro Ilaya","Soro-soro Kanluran","Talisay","Tambo","Tangob","Tanguay","Tibig","Tipacan"],
    "Tanauan City": ["Ambulong","Bagbag","Bagumbayan","Balele","Bañadero","Bañago","Barangay 1","Barangay 2","Barangay 3","Barangay 4","Barangay 5","Barangay 6","Bilog-bilog","Boot","Cale","Darasa","Gonzales","Hidalgo","Janopol","Janopol Oriental","Laurel","Luyos","Mabini","Malaking Pulo","Maria Paz","Mataas na Lupa","Natatas","Pagaspas","Pantay Matanda","Pantay Bata","Pinagtung-ulan","Poblacion","Pook","Sambat","San Jose","San Guillermo","Santa Cruz","Santol","Sulpoc","Suplang","Talaga","Tinurik","Trapiche","Ulango","Wawa"],
    "Cebu City": ["Adlaon","Agsungot","Apas","Bacayan","Banilad","Basak Pardo","Basak San Nicolas","Binaliw","Bonbon","Budla-an","Buhisan","Bulacao","Buot-Taup","Busay","Calamba","Cambinocot","Camputhaw","Capitol Site","Carreta","Central","Cogon Pardo","Cogon Ramos","Day-as","Duljo","Ermita","Guadalupe","Guba","Hippodromo","Inayawan","Kalubihan","Kalunasan","Kamagayan","Kasambagan","Kinasang-an","Labangon","Lahug","Lorega San Miguel","Lusaran","Luz","Mabini","Mabolo","Malubog","Mambaling","Mohon","Nga-nga","Pardo","Pari-an","Pasil","Pit-os","Poblacion Pardo","Pulangbato","Punta Princesa","Quiot Pardo","Sambag I","Sambag II","San Antonio","San Jose","San Nicolas Proper","San Roque","Santa Cruz","Santo Niño","Sapangdaku","Sawang Calero","Sinsin","Sirao","Suba","Sudlon I","Sudlon II","T. Padilla","Talamban","Taptap","Tejero","Tinago","Tisa","To-ong","Tungkop"],
    "Mandaue": ["Alang-alang","Bakilid","Banilad","Basak","Cambaro","Canduman","Casili","Casuntingan","Centro","Cubacub","Guizo","Ibabao-Estancia","Jagobiao","Labogon","Looc","Maguikay","Mantuyong","Opao","Pakna-an","Paknaan","Subangdaku","Tagbilaran Proper","Tingub","Tipolo","Umapad"],
    "Lapu-Lapu": ["Agus","Babag","Bankal","Baring","Basak","Buaya","Calawisan","Canjulao","Caubian","Caw-oy","Cawhagan","Gun-ob","Ibo","Looc","Mactan","Maribago","Marigondon","Pajac","Pajo","Pangan-an","Poblacion","Pusok","Sukbalay","Talima","Tingo","Tungasan"],
    "Talisay": ["Biasong","Bulacao","Cadulawan","Cansojong","Dumlog","Jaclupan","Lagtang","Lawaan I","Lawaan II","Lawaan III","Linao","Manipis","Mohon","Poblacion","Pooc","San Isidro","San Roque","Tabunok","Tapul"],
    "Davao City": ["Agdao","Alejandra Navarro","Bago Aplaya","Bago Gallera","Bago Oshiro","Baliok","Baracatan","Barangay 1-A","Barangay 2-A","Barangay 3-A","Barangay 4-A","Barangay 5-A","Barangay 6-A","Barangay 7-A","Barangay 8-A","Barangay 9-A","Barangay 10-A","Binugao","Bucana","Buda","Buhangin","Bunawan","Cabantian","Calinan","Callawa","Camansi","Carmen","Catalunan Grande","Catalunan Pequeño","Catigan","Communal","Crossing Bayabas","Dacudao","Dalag","Datu Salumay","Dominga","Dumoy","Eden","Fatima","Gatungan","Gov. Paciano Bangoy","Gov. Vicente Duterte","Gumalang","Gumitan","Ilang","Indangan","Lacson","Lamanan","Langub","Leon Garcia Sr.","Lizada","Lubogan","Lumiad","Ma-a","Mabuhay","Magsaysay","Malabog","Malagos","Malamba","Manambulan","Mandug","Manuel Guianga","Mapula","Marapangi","Marilog","Matina Aplaya","Matina Crossing","Matina Pangi","Mintal","New Carmen","New Valencia","Pampanga","Panacan","Pandaitan","Paquibato","Rafael Castillo","Riverside","Salapawan","Salaysay","San Antonio","San Isidro","Santo Niño","Sasa","Sibulan","Sirawan","Subasta","Sumimao","Tacunan","Talomo","Tamayong","Tamugan","Tibuloy","Tibungco","Tigatto","Toril","Tugbok","Tungkalan","Ubalde","Ula","Uyanguren"],
    "Digos": ["Aplaya","Balabag","Balagnan","Balindog","Binaton","Cogon","Colorado","Dulangan","Goma","Igpit","Kapatagan","Kibaoni","Kulaman","Lamanan","Lenienza","Lungag","Mahayahay","Matti","Ruparan","San Agustin","San Jose","San Miguel","San Roque","Sinawilan","Soong","Tiguman","Tres de Mayo","Zone I","Zone II","Zone III"],
    "Iloilo City": ["Aguinaldo","Balabag","Bakhaw","Balantang","Bolilao","Bonifacio","Buntatala","Cabugao Norte","Cabugao Sur","Calaparan","Camalig","Carpenter Hill","Cochero","Concepcion-Montes","Condeza","Cor Jesu","Cuartero","Danao","Delgado-Jalandoni-Bagumbayan","Demo","Divinagracia","Dungon A","Dungon B","Dungon C","East Baluarte","East Timawa","Fajardo","Flores","Hibao-an Norte","Hibao-an Sur","Hinactacan","Hipodromo","Ingore","Jibao-an","La Paz","Laguda","Lapaz","Lapuz Norte","Lapuz Sur","Layac","Libertad","Loboc","Logon","Lonoy","Lopez Jaena Norte","Lopez Jaena Sur","Luna","Maasin","Magsaysay","Malipayon","Mansaya","Montinola","Muelle Loney","Namocon","Napnapan Norte","Napnapan Sur","Oñate de Leon","Ortiz","Osmeña","Our Lady of Lourdes","Pale Benedicto","Pale Ortelano","Palaypay","Pancul","Progreso","Punong","Quezon","Rednaxela","Republic","Rizal","Rizal Poblacion","Sto. Niño Norte","Sto. Niño Sur","Sampaguita","San Agustin","San Felipe","San Isidro","San Jose","San Juan","San Pedro","Santa Filomena","Santo Domingo","Santo Niño","Santos Corazon","Seminario","Simon Ledesma","South Baluarte","South Fundidor","South San Jose","Taal","Tacas","Talon","Tanza","Tico","Timawa Tanza I","Timawa Tanza II","Veterans Village","Villa Anita","West Habog-habog","West Timawa","Yulo Drive","Yulo-arroyo","Zamora-Melliza"],
    "Tagbilaran": ["Bool","Booy","Cogon","Dao","Dampas","Manga","Mansasa","Poblacion I","Poblacion II","Poblacion III","San Isidro","Taloto","Tiptip","Ubujan"],
    "Tacloban": ["Barangay 1-A","Barangay 2","Barangay 3","Barangay 4","Barangay 5","Barangay 6","Barangay 7","Barangay 8","Barangay 9","Barangay 10","Barangay 11","Barangay 12","Barangay 13","Barangay 14","Barangay 15","Barangay 16","Barangay 17","Barangay 18","Barangay 19","Barangay 20","Barangay 21","Barangay 22","Barangay 23","Barangay 24","Barangay 25","Barangay 26","Barangay 27","Barangay 28","Barangay 29","Barangay 30"],
    "Bacolod": ["Alijis","Bata","Cabug","Estefania","Felisa","Granada","Handumanan","Junction Araneta-Galo","Katilingban","Lag-asan","Mandalagan","Mansilingan","Montevista","Pahanocoy","Punta Taytay","Singcang-Airport","Sum-ag","Taculing","Tangub","Tasay","Villamonte","Vista Alegre"],
    "Angeles": ["Agapito del Rosario","Amsic","Anunas","Balibago","Capaya","Claro M. Recto","Cuayan","Cutcut","Cutud","Lourdes Norte","Lourdes Sur","Lourdes Sur East","Malabanias","Margot","Mining","Pampang","Pandan","Pulung Bulu","Pulung Cacutud","Pulung Maragul","Salapungan","San Jose","San Nicolas","Santa Trinindad","Santo Cristo","Santo Domingo","Santo Rosario","Sapalibutad","Sapangbato","Tabun","Virgen Delos Remedios"],
    "San Fernando": ["Alasas","Baliti","Bulaon","Calulut","Del Carmen","Del Pilar","Del Rosario","Dela Paz Norte","Dela Paz Sur","Dolores","Juliana","Lara","Lourdes","Magliman","Maimpis","Malino","Malpitic","Pandaras","Panipuan","Pulung Bulu","Quebiawan","Saguin","San Agustin","San Felipe","San Isidro","San Jose","San Juan","San Nicolas","San Pedro","Santa Lucia","Santa Teresita","Santo Niño","Santo Rosario","Sindalan","Telabastagan"],
    "Malolos": ["Anilao","Atlag","Babatnin","Bagna","Bagong Bayan","Balayong","Balite","Bangkal","Barihan","Bulihan","Bungahan","Caingin","Calero","Calizon","Calumpang","Canalate","Caniogan","Catmon","Clay","Curingao","Garlang","Guinhawa","Liang","Ligas","Liyang","Longos","Look 1st","Look 2nd","Lugam","Mabolo","Mambog","Masile","Matimbo","Mojon","Namayan","Niugan","Pamarawan","Panasahan","Pinagbakahan","San Agustin","San Gabriel","San Juan","San Pablo","Santa Clara","Santa Cruz","Santiago","Santisima Trinidad","Santo Cristo","Santo Niño","Santos","Santol","Sumapang Bata","Sumapang Matanda","Taal","Tikay"],
    "Meycauayan": ["Bagbaguin","Bahay Pare","Bancal","Banga","Bayugo","Caingin","Calvario","Camalig","Gasak","Hulo","Iba","Langka","Lawa","Libtong","Liputan","Longos","Malhacan","Pajo","Pandayan","Pantoc","Perez","Poblacion","Saluysoy","Saint Francis Valley","Tugatog","Ubihan","Zamora"],
    "San Jose del Monte": ["Assumption","Bagong Buhay I","Bagong Buhay II","Bagong Buhay III","Citrus","Ciudad Real","Dulong Bayan","Fatima I","Fatima II","Fatima III","Fatima IV","Fatima V","Francisco Homes-Guijo","Francisco Homes-Mulawin","Francisco Homes-Narra","Francisco Homes-Yakal","Gaya-gaya","Graceville","Gumaok Central","Gumaok East","Gumaok West","Kaybanban","Kaypian","Lawang Pare","Maharlika","Minuyan I","Minuyan II","Minuyan III","Minuyan IV","Minuyan V","Minuyan Proper","Paradise III","Poblacion","San Isidro Labrador I","San Isidro Labrador II","San Manuel","San Martin I","San Martin II","San Martin III","San Martin IV","San Pedro","San Rafael I","San Rafael II","San Rafael III","San Rafael IV","San Rafael V","Santa Cruz I","Santa Cruz II","Santa Cruz III","Santa Cruz IV","Santa Cruz V","Santo Cristo I","Santo Cristo II","Sapang Palay Proper","Sapang Palay Proper II","Tierra Nova","Tungkong Mangga","Valle Verde"],
    "Antipolo": ["Bagong Nayon","Beverly Hills","Calawis","Cupang","Dalig","Dela Paz","Inarawan","Mambugan","Mayamot","Muntingdilaw","San Isidro","San Jose","San Juan","San Luis","San Roque","Santa Cruz","Santo Niño","Sinag","Sta. Cruz"],
    "Cainta": ["Banlat","Concepcion Dos","Concepcion Uno","Dela Paz","Guinayan","Minuyan","San Andres","San Juan","Santa Rosa","Santo Domingo"],
    "Taytay": ["Dolores","Muzon","Pagasa","San Isidro","San Juan","Santa Ana"],
    "Dagupan": ["Bacayao Norte","Bacayao Sur","Barangay I","Barangay II","Barangay III","Barangay IV","Bolosan","Bonuan Binloc","Bonuan Boquig","Bonuan Gueset","Calmay","Carael","Caranglaan","Herrero","Lasip Chico","Lasip Grande","Lomboy","Lucao","Malued","Mamalingling","Mangin","Mayombo","Pantal","Poblacion Oeste","Pogo Chico","Pogo Grande","Pugaro Suit","Salapingao","Salisay","Tambac","Tapuac","Tebeng"],
    "Legazpi": ["Arimbay","Bagong Abre","Bagumbayan","Banquerohan","Barangay 1","Barangay 2","Barangay 3","Barangay 4","Barangay 5","Bigaa","Bonot","Buyuan","Camatchile","Cararayan","Carolina","Cruzada","Dap-dap","Del Rosario","Estanza","Gogon","Homapon","Imalnod","Magallanes","Maoyod","Maugnao","Naga","Pawa","Pepita","Pigcale","Port Area","Pulo","Rawis","Sagpon","Sapon","Savannah","Tamaoyan","Taysan","Tigbao","Tula-tula Grande","Tula-tula Pequeño","Ulay"],
    "_default": ["Poblacion","San Antonio","San Jose","San Pedro","San Roque","Santa Cruz","Santa Maria","Santo Niño","Santo Tomas","Bagong Silang","Bagong Pag-asa","Maligaya","Masagana","Mabuhay","Bagumbayan","Pag-asa","Bulaklak","Narra","Molave","Batasan","Rizal","Mabini","del Pilar","Bonifacio","Aguinaldo","Kalayaan"],
  };

  const citiesForProvince = form.province && CITIES_BY_PROVINCE[form.province]
    ? CITIES_BY_PROVINCE[form.province] : [];

  const barangaysForCity = form.city
    ? (BARANGAYS_BY_CITY[form.city] || BARANGAYS_BY_CITY["_default"]) : [];

  const handleImageChange = e => {
    const file = e.target.files[0];
    if (file) { setProfilePic(file); setPreview(URL.createObjectURL(file)); }
  };

  const openCamera = async () => {
    setCameraError(""); setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
      setCameraStream(stream);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 100);
    } catch { setCameraError("Camera access denied or not available. Please allow camera permission and try again."); }
  };

  const closeCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null); setShowCamera(false); setCameraError("");
  };

  const capturePhoto = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      setProfilePic(file); setPreview(canvas.toDataURL("image/jpeg")); closeCamera();
    }, "image/jpeg", 0.92);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMessage(""); setPhoneTouched(true); setEmergPhoneTouched(true);

    if (!profilePic)                        { setErrorMessage("Please upload a profile photo."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (!form.fullName.trim())              { setErrorMessage("Full Name is required."); return; }
    if (!form.studentId.trim())             { setErrorMessage("Student ID is required."); return; }
    if (!form.sex)                          { setErrorMessage("Please select your Sex."); return; }
    if (!form.birthdate)                    { setErrorMessage("Date of Birth is required."); return; }
    if (!form.department)                   { setErrorMessage("Please select your Course / Department."); return; }
    if (!form.yearLevel)                    { setErrorMessage("Please select your Year Level."); return; }
    if (!form.section.trim())               { setErrorMessage("Section is required."); return; }
    if (!isValidPhone(form.phone))          { setErrorMessage("Phone Number is invalid. Must start with 9 and be 10 digits (e.g. 9171234567)."); return; }
    if (!isValidPhone(form.emergencyPhone)) { setErrorMessage("Emergency Contact Number is invalid. Must start with 9 and be 10 digits."); return; }
    if (!form.emergencyName.trim())         { setErrorMessage("Emergency Contact Name is required."); return; }
    if (!form.province)                     { setErrorMessage("Please select your Province."); return; }
    if (!form.city.trim())                  { setErrorMessage("Please select or enter your City / Municipality."); return; }
    if (!form.barangay.trim())              { setErrorMessage("Please select or enter your Barangay."); return; }
    if (!form.street.trim())                { setErrorMessage("House No. / Street / Purok is required."); return; }

    const token = user?.token || user?.access_token;
    if (!token) { setErrorMessage("Session expired. Please log in again."); return; }

    try {
      setLoading(true);
      const formData = new FormData();
      Object.entries({
        full_name:       form.fullName,
        email:           form.email,
        student_id:      form.studentId,
        sex:             form.sex,
        birthdate:       form.birthdate,
        department:      form.department,
        year_level:      form.yearLevel,
        section:         form.section,
        phone:           toStoredPhone(form.phone),
        address:         [form.street, form.barangay, form.city, form.province].filter(Boolean).join(", "),
        street:          form.street,
        barangay:        form.barangay,
        city:            form.city,
        province:        form.province,
        emergency_name:  form.emergencyName,
        emergency_phone: toStoredPhone(form.emergencyPhone),
      }).forEach(([k, v]) => formData.append(k, v));

      if (profilePic) formData.append("profile_pic", profilePic);

      await axios.post("http://127.0.0.1:8000/api/user/profile/setup", formData, {
        headers: { "Content-Type": "multipart/form-data", "Authorization": `Bearer ${token}` },
      });
      localStorage.setItem("user", JSON.stringify({ ...user, profile_completed: true }));
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 401)      setErrorMessage("Session expired. Please log in again.");
      else if (err.response?.status === 422) {
        const errors = err.response.data?.errors;
        setErrorMessage(errors ? Object.values(errors)[0][0] : "Validation error.");
      } else setErrorMessage("Error saving profile. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${T.navyDark} 0%, ${T.navyBg} 55%, #1a3356 100%)`,
        fontFamily: font, padding: "36px 20px 60px",
      }}>

        {/* Brand strip */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "8px 20px",
            backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <span style={{ fontSize: "1.1rem" }}>🎓</span>
            <span style={{ color: "rgba(255,255,255,0.88)", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.08em" }}>
              STUDENT COUNSELING SYSTEM
            </span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          maxWidth: 780, margin: "0 auto", background: T.white, borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.1) inset",
          overflow: "hidden",
        }}>
          <div style={{ height: 5, background: `linear-gradient(90deg, ${T.blue} 0%, ${T.teal} 100%)` }} />

          <div style={{ padding: "34px 40px 44px" }}>
            <div style={{ textAlign: "center", marginBottom: 30 }}>
              <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: T.navy, letterSpacing: "-0.02em" }}>
                Complete Your Profile
              </h1>
              <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: T.textMuted }}>
                Fill in your details to start using the Student Counseling System
              </p>
            </div>

            {/* Profile Photo */}
            <div style={{ background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "20px 22px" }}>
              <p style={{ margin: "0 0 16px", fontSize: "0.72rem", fontWeight: 700, color: T.slate, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                📷 Profile Photo
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <div style={{
                  width: 86, height: 86, borderRadius: "50%", flexShrink: 0,
                  border: `3px solid ${preview ? T.blue : T.border}`,
                  background: preview ? "transparent" : "#e2e8f0", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: preview ? `0 0 0 4px ${T.blueLight}` : "none", transition: "all 0.2s",
                }}>
                  {preview
                    ? <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" fill={T.slateLight} />
                        <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke={T.slateLight} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: preview ? T.green : T.textMuted }}>
                    {preview ? "✅ Photo selected — looking good!" : "No photo uploaded yet. Choose one of the options below:"}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label htmlFor="profilePicFile" style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 7, background: T.white,
                      border: `1.5px solid ${T.blue}`, color: T.blue,
                      fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: font,
                    }}>🖼️ Upload from Gallery</label>
                    <input id="profilePicFile" type="file" accept="image/*" onChange={handleImageChange} hidden />
                    <button type="button" onClick={openCamera} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 7, background: T.white,
                      border: "1.5px solid #16a34a", color: "#16a34a",
                      fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: font,
                    }}>📸 Take Selfie</button>
                    {preview && (
                      <button type="button" onClick={() => { setPreview(null); setProfilePic(null); }} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 7, background: T.white,
                        border: `1.5px solid ${T.red}`, color: T.red,
                        fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: font,
                      }}>🗑️ Remove</button>
                    )}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "0.71rem", color: T.slateLight }}>Accepted: JPG, PNG — max 5 MB</p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div style={{
                marginTop: 16, background: "#fef2f2", color: T.red,
                border: "1px solid #fecaca", padding: "11px 14px", borderRadius: 9,
                fontSize: "0.86rem", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>⚠️</span> {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Basic Information */}
              <SectionHeader icon="👤" title="Basic Information" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
                <div>
                  <Label required>Full Name</Label>
                  <Input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Enter your full name" required />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input name="email" type="email" value={form.email} readOnly
                    style={{ background: T.bg, color: T.slateLight, cursor: "not-allowed" }} />
                </div>
                <div>
                  <Label required>Student ID</Label>
                  <Input name="studentId" value={form.studentId} onChange={handleChange} placeholder="e.g. 2024-00142" required />
                </div>
                <div>
                  <Label required>Sex</Label>
                  <Select name="sex" value={form.sex} onChange={handleChange} required>
                    <option value="">Select sex…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </div>
                <div>
                  <Label required>Date of Birth</Label>
                  <Input type="date" name="birthdate" value={form.birthdate} onChange={handleChange} required />
                </div>
              </div>

              {/* Academic Information */}
              <SectionHeader icon="🎓" title="Academic Information" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
                <div>
                  <Label required>Course / Department</Label>
                  <Select name="department" value={form.department} onChange={handleChange} required>
                    <option value="">Select course…</option>
                    <option value="BA Political Science">BA Political Science</option>
                    <option value="BA Communication">BA Communication</option>
                    <option value="BEED">BEED</option>
                    <option value="BSED">BSED</option>
                    <option value="BSIT">BSIT</option>
                    <option value="BSOA">BSOA</option>
                    <option value="BSCrim">BSCrim</option>
                  </Select>
                </div>
                <div>
                  <Label required>Year Level</Label>
                  <Select name="yearLevel" value={form.yearLevel} onChange={handleChange} required>
                    <option value="">Select year level…</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </Select>
                </div>
                <div>
                  <Label required>Section</Label>
                  <Input name="section" value={form.section} onChange={handleChange} placeholder="e.g. Block-5, Section A" required />
                </div>
              </div>

              {/* Contact Information */}
              <SectionHeader icon="📞" title="Contact Information" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", marginBottom: 14 }}>

                {/* Your Phone */}
                <div>
                  <Label required>Your Phone Number</Label>
                  {(() => {
                    const st = phoneStatus(form.phone, phoneTouched);
                    const bc = phoneBorderColor(st);
                    const bs = phoneBoxShadow(st);
                    return (
                      <>
                        <div style={{ display: "flex" }}>
                          {/* ✅ FIXED: longhand borders — no React shorthand warning */}
                          <span style={{
                            padding: "10px 10px",
                            background: "#f0f4ff",
                            ...prefixBorderStyle(bc),
                            borderRadius: "8px 0 0 8px",
                            fontSize: "0.82rem",
                            color: T.navy,
                            fontWeight: 700,
                            fontFamily: font,
                            whiteSpace: "nowrap",
                            lineHeight: 1.5,
                            transition: "border-color 0.18s",
                          }}>🇵🇭 +63</span>
                          <input
                            name="phone" value={form.phone}
                            onChange={handlePhone("phone")}
                            placeholder="9XXXXXXXXX"
                            maxLength={10} inputMode="numeric"
                            style={{ ...inputBase, borderRadius: "0 8px 8px 0", borderLeft: "none", flex: 1, borderColor: bc, boxShadow: bs }}
                            onFocus={e => { e.target.style.borderColor = st === "valid" ? T.green : T.blue; e.target.style.boxShadow = st === "valid" ? "0 0 0 3px #dcfce7" : `0 0 0 3px ${T.blueLight}`; }}
                            onBlur={e => { setPhoneTouched(true); e.target.style.borderColor = phoneBorderColor(phoneStatus(form.phone, true)); e.target.style.boxShadow = phoneBoxShadow(phoneStatus(form.phone, true)); }}
                          />
                        </div>
                        {st === "valid"        && <span style={{ fontSize: "0.72rem", color: T.green,   marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>✅ Valid — will save as 0{form.phone}</span>}
                        {st === "incomplete"   && <span style={{ fontSize: "0.72rem", color: "#b45309", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>⏳ {10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? "s" : ""} needed</span>}
                        {st === "wrong_prefix" && <span style={{ fontSize: "0.72rem", color: T.red,     marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>❌ Must start with <strong style={{ marginLeft: 3 }}>9</strong> (e.g. 9171234567)</span>}
                        {(st === "error" && phoneTouched) && <span style={{ fontSize: "0.72rem", color: T.red, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>❌ Phone number is required</span>}
                        {st === "empty" && <span style={{ fontSize: "0.68rem", color: T.slateLight, marginTop: 3, display: "block" }}>Format: 9XXXXXXXXX (10 digits) — 0 added automatically</span>}
                      </>
                    );
                  })()}
                </div>

                {/* Emergency Phone */}
                <div>
                  <Label required>Emergency Contact Number</Label>
                  {(() => {
                    const val = form.emergencyPhone;
                    const st = phoneStatus(val, emergPhoneTouched);
                    const bc = phoneBorderColor(st);
                    const bs = phoneBoxShadow(st);
                    return (
                      <>
                        <div style={{ display: "flex" }}>
                          {/* ✅ FIXED: longhand borders — no React shorthand warning */}
                          <span style={{
                            padding: "10px 10px",
                            background: "#f0f4ff",
                            ...prefixBorderStyle(bc),
                            borderRadius: "8px 0 0 8px",
                            fontSize: "0.82rem",
                            color: T.navy,
                            fontWeight: 700,
                            fontFamily: font,
                            whiteSpace: "nowrap",
                            lineHeight: 1.5,
                            transition: "border-color 0.18s",
                          }}>🇵🇭 +63</span>
                          <input
                            name="emergencyPhone" value={form.emergencyPhone}
                            onChange={handlePhone("emergencyPhone")}
                            placeholder="9XXXXXXXXX"
                            maxLength={10} inputMode="numeric"
                            style={{ ...inputBase, borderRadius: "0 8px 8px 0", borderLeft: "none", flex: 1, borderColor: bc, boxShadow: bs }}
                            onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
                            onBlur={e => { setEmergPhoneTouched(true); const s2 = phoneStatus(form.emergencyPhone, true); e.target.style.borderColor = phoneBorderColor(s2); e.target.style.boxShadow = phoneBoxShadow(s2); }}
                          />
                        </div>
                        {val && st === "valid"        && <span style={{ fontSize: "0.72rem", color: T.green,   marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>✅ Valid — will save as 0{val}</span>}
                        {val && st === "incomplete"   && <span style={{ fontSize: "0.72rem", color: "#b45309", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>⏳ {10 - val.length} more digit{10 - val.length !== 1 ? "s" : ""} needed</span>}
                        {val && st === "wrong_prefix" && <span style={{ fontSize: "0.72rem", color: T.red,     marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>❌ Must start with <strong style={{ marginLeft: 3 }}>9</strong> (e.g. 9171234567)</span>}
                        {!val && <span style={{ fontSize: "0.68rem", color: T.slateLight, marginTop: 3, display: "block" }}>Format: 9XXXXXXXXX (10 digits) — 0 added automatically</span>}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Emergency Contact Name */}
              <div style={{ marginBottom: 22 }}>
                <Label required>Emergency Contact Name</Label>
                <Input name="emergencyName" value={form.emergencyName} onChange={handleChange} placeholder="Parent / Guardian full name" />
              </div>

              {/* Home Address */}
              <SectionHeader icon="🏠" title="Home Address" />
              <p style={{ margin: "-10px 0 16px", fontSize: "0.78rem", color: T.textMuted }}>
                Fill in your address step by step — select <strong>Province</strong> first, then <strong>City</strong>, then <strong>Barangay</strong>.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: T.slate, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span style={{ background: T.blue, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, flexShrink: 0 }}>1</span>
                    Province <span style={{ color: T.red }}>*</span>
                  </label>
                  <Select name="province" value={form.province}
                    onChange={e => setForm(f => ({ ...f, province: e.target.value, city: "", barangay: "" }))} required>
                    <option value="">— Select Province —</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: form.province ? T.slate : T.slateLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span style={{ background: form.province ? T.blue : T.slateLight, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, flexShrink: 0 }}>2</span>
                    City / Municipality
                  </label>
                  {citiesForProvince.length > 0 ? (
                    <Select name="city" value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value, barangay: "" }))}
                      disabled={!form.province} style={{ opacity: form.province ? 1 : 0.5 }}>
                      <option value="">— Select City —</option>
                      {citiesForProvince.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  ) : (
                    <Input name="city" value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value, barangay: "" }))}
                      placeholder={form.province ? "Type city / municipality" : "Select province first"}
                      disabled={!form.province} style={{ opacity: form.province ? 1 : 0.5 }} />
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.72rem", color: form.city ? T.slate : T.slateLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <span style={{ background: form.city ? T.blue : T.slateLight, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, flexShrink: 0 }}>3</span>
                  Barangay
                </label>
                {barangaysForCity.length > 0 ? (
                  <Select name="barangay" value={form.barangay} onChange={handleChange}
                    disabled={!form.city} style={{ opacity: form.city ? 1 : 0.5 }}>
                    <option value="">— Select Barangay —</option>
                    {barangaysForCity.map(b => <option key={b} value={b}>{b}</option>)}
                  </Select>
                ) : (
                  <Input name="barangay" value={form.barangay} onChange={handleChange}
                    placeholder={form.city ? "Type your barangay" : "Select city first"}
                    disabled={!form.city} style={{ opacity: form.city ? 1 : 0.5 }} />
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.72rem", color: T.slate, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <span style={{ background: T.blue, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, flexShrink: 0 }}>4</span>
                  House No. / Street / Purok <span style={{ color: T.red }}>*</span>
                </label>
                <Input name="street" value={form.street} onChange={handleChange} placeholder="e.g. 123 Rizal Street, Purok 2" required />
              </div>

              {(form.province || form.city || form.barangay || form.street) && (
                <div style={{
                  padding: "10px 14px", marginBottom: 8,
                  background: "linear-gradient(135deg, #eff6ff, #f0fdf4)",
                  border: "1px solid #bfdbfe", borderRadius: 10,
                  fontSize: "0.8rem", color: T.navy,
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>📌</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: T.slate }}>Full Address Preview</div>
                    <div style={{ color: T.navy, lineHeight: 1.5 }}>
                      {[form.street, form.barangay, form.city, form.province].filter(Boolean).join(", ")}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 30 }}>
                <button type="submit" disabled={loading} style={{
                  width: "100%", padding: "14px",
                  background: loading ? T.slateLight : `linear-gradient(135deg, ${T.blue} 0%, ${T.teal} 100%)`,
                  color: T.white, border: "none", borderRadius: 10,
                  fontWeight: 700, fontSize: "0.97rem", fontFamily: font,
                  cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.02em",
                  boxShadow: loading ? "none" : "0 4px 14px rgba(37,99,235,0.3)", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {loading ? (
                    <>
                      <span style={{ display: "inline-block", width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Saving your profile…
                    </>
                  ) : "Save Profile & Continue →"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
          Your information is kept private and secure.
        </p>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,20,40,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.white, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.4)", fontFamily: font }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <span style={{ fontWeight: 800, fontSize: "1rem", color: T.navy }}>📸 Take a Selfie</span>
              <button type="button" onClick={closeCamera} style={{ background: T.bg, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: T.slate, fontWeight: 600, fontFamily: font, fontSize: "0.85rem" }}>✕ Close</button>
            </div>
            {cameraError ? (
              <div style={{ background: "#fef2f2", color: T.red, border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", fontSize: "0.85rem", textAlign: "center" }}>⚠️ {cameraError}</div>
            ) : (
              <>
                <div style={{ borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 14, position: "relative" }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <div style={{ width: 140, height: 180, borderRadius: "50%", border: "2.5px dashed rgba(255,255,255,0.6)" }} />
                  </div>
                </div>
                <p style={{ fontSize: "0.75rem", color: T.slateLight, textAlign: "center", margin: "0 0 14px" }}>
                  Position your face inside the oval, then tap <strong>Capture</strong>
                </p>
                <button type="button" onClick={capturePhoto} style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, ${T.blue}, ${T.teal})`, color: T.white, border: "none", borderRadius: 10, fontWeight: 700, fontSize: "1rem", cursor: "pointer", fontFamily: font, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}>
                  📸 Capture Photo
                </button>
              </>
            )}
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>
    </>
  );
}

export default SetupProfile;