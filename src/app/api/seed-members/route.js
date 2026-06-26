import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function buildProfiles() {
    const profiles = [];
    let idx = 0;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randAge = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const randPhone = (code) => `${code} 7${String(Math.floor(Math.random()*100000000)).padStart(8,'0')}`;

    const FEMALE_BIOS = [
        'Mature, successful businesswoman seeking a genuine, respectful young man for companionship.',
        'Independent woman with a big heart. Looking for a charming gentleman who values loyalty.',
        'Life is too short to be alone. Seeking a caring, honest young man for something real.',
        'Blessed and living well. Looking for a humble, hardworking gentleman to share the good life.',
        'Confident, classy woman who loves adventure. I want a real man who matches my energy.',
        'Successful, God-fearing woman looking for a genuine young man for a serious relationship.',
        'A queen looking for her king. Must be loyal, respectful, and ready for commitment.',
        'Living my best life and looking for a handsome, caring man to complement it.',
        'Financially stable woman seeking meaningful companionship. No time wasters please.',
        'Sophisticated lady looking for a fun, intelligent gentleman. Age is just a number.',
    ];
    const MALE_BIOS = [
        'Business owner with a good heart. Seeking a genuine, trustworthy young lady for real connection.',
        'Life is better shared. Looking for a beautiful, ambitious young lady who values honesty.',
        'Successful entrepreneur looking for a caring, loving young woman to build something real.',
        'Gentleman of means seeking a loyal, down-to-earth young lady for companionship.',
        'Well-established man looking for a beautiful, respectful girl who appreciates finer things.',
        'Mature, responsible man. Seeking a sweet, caring young lady for a genuine connection.',
    ];

    // â•â•â• KENYA FEMALES (50) â€” seed-f-001 to seed-f-050 â•â•â•
    const KF = ['Grace Wanjiku','Faith Muthoni','Esther Akinyi','Margaret Nyambura','Catherine Wairimu','Mercy Chebet','Janet Wambui','Aisha Abdalla','Lucy Njeri','Priscilla Atieno','Beatrice Wangari','Susan Mwikali','Dorothy Auma','Gladys Chepkorir','Caroline Mutiso','Teresa Achieng','Mary Anyango','Olive Chepchumba','Eunice Kerubo','Helen Wamuyu','Christine Mwanaisha','Rose Njoki','Agnes Wekesa','Pauline Adhiambo','Irene Mwende','Victoria Nekesa','Nancy Wambui','Sarah Kigen','Purity Moraa','Lilian Kwamboka','Martha Wafula','Florence Naserian','Rita Akoth','Joyce Kemunto','Monica Nyokabi','Ann Chepngetich','Diana Onyango','Jane Mwendwa','Deborah Chelagat','Jacqueline Awino','Elizabeth Njambi','Rachel Wanga','Millicent Cheruiyot','Peninah Bosibori','Tabitha Ogutu','Emily Muthiga','Alice Wafula','Brenda Achi','Linda Njiru','Veronica Sang'];
    const KFL = ['Nairobi - Westlands','Nairobi - Kilimani','Nairobi - Karen','Nairobi - Lavington','Nairobi - Kileleshwa','Mombasa - Nyali','Mombasa - Bamburi','Kisumu','Nakuru','Eldoret','Thika','Naivasha','Machakos','Nyeri','Nanyuki','Malindi','Diani','Kitale','Meru','Nairobi - Runda'];
    let fIdx = 1;
    for (let i = 0; i < 50; i++) {
        const n = KF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(32,52), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Kenya', location:KFL[i%KFL.length], nationality:'Kenya', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+254') }); idx++; fIdx++;
    }
    // â•â•â• UGANDA FEMALES (12) â•â•â•
    const UF = ['Anita Nakamya','Dorothy Namukasa','Prossy Nalwanga','Sarah Atim','Harriet Nabirye','Winnie Nansubuga','Betty Akello','Flavia Nakanwagi','Joan Aber','Patience Namusisi','Irene Nambi','Gloria Akot'];
    const UFL = ['Kampala - Kololo','Kampala - Nakasero','Kampala - Bugolobi','Kampala - Muyenga','Entebbe','Jinja','Gulu','Mbarara'];
    for (let i = 0; i < 12; i++) {
        const n = UF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(32,50), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Uganda', location:UFL[i%UFL.length], nationality:'Uganda', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+256') }); idx++; fIdx++;
    }
    // â•â•â• TANZANIA FEMALES (10) â•â•â•
    const TF = ['Rehema Mwakalinga','Happiness Mushi','Neema Kimaro','Amina Hassan','Salma Juma','Zawadi Mwasonga','Farida Ally','Glory Mfaume','Halima Msham','Paulina Swai'];
    const TFL = ['Dar es Salaam - Masaki','Dar es Salaam - Oyster Bay','Dar es Salaam - Mikocheni','Arusha','Zanzibar','Dodoma','Mwanza'];
    for (let i = 0; i < 10; i++) {
        const n = TF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(32,48), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Tanzania', location:TFL[i%TFL.length], nationality:'Tanzania', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+255') }); idx++; fIdx++;
    }
    // â•â•â• ZIMBABWE FEMALES (8) â•â•â•
    const ZF = ['Rudo Moyo','Tatenda Chirwa','Chiedza Mutasa','Rumbidzai Nyathi','Tsitsi Mhandu','Nyasha Chigwedere','Tendai Maposa','Sithembile Ndlovu'];
    const ZFL = ['Harare - Avondale','Harare - Borrowdale','Bulawayo','Mutare','Victoria Falls'];
    for (let i = 0; i < 8; i++) {
        const n = ZF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(33,50), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Zimbabwe', location:ZFL[i%ZFL.length], nationality:'Zimbabwe', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+263') }); idx++; fIdx++;
    }
    // â•â•â• MALAWI FEMALES (5) â•â•â•
    const MWF = ['Chimwemwe Banda','Thandiwe Phiri','Tamara Mbewe','Precious Gondwe','Tiwonge Kamanga'];
    const MWFL = ['Lilongwe','Blantyre','Mzuzu','Zomba'];
    for (let i = 0; i < 5; i++) {
        const n = MWF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(33,48), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Malawi', location:MWFL[i%MWFL.length], nationality:'Malawi', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+265') }); idx++; fIdx++;
    }
    // â•â•â• RWANDA FEMALES (5) â•â•â•
    const RWF = ['Diane Uwimana','Claudine Mukamana','Ange Ishimwe','Sandrine Umutoni','Vestine Ingabire'];
    const RWFL = ['Kigali - Nyarutarama','Kigali - Kimihurura','Gisenyi','Butare'];
    for (let i = 0; i < 5; i++) {
        const n = RWF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(30,46), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Rwanda', location:RWFL[i%RWFL.length], nationality:'Rwanda', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+250') }); idx++; fIdx++;
    }
    // â•â•â• BURUNDI FEMALES (4) â•â•â•
    const BIF = ['Aline Niyonzima','Claudette Ndayishimiye','Esperance Hakizimana','Josiane Niyongabo'];
    const BIFL = ['Bujumbura - Centre','Bujumbura - Kanyosha','Gitega'];
    for (let i = 0; i < 4; i++) {
        const n = BIF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(32,45), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Burundi', location:BIFL[i%BIFL.length], nationality:'Burundi', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+257') }); idx++; fIdx++;
    }
    // â•â•â• SOUTH SUDAN FEMALES (4) â•â•â•
    const SSF = ['Mary Achol','Grace Ayen','Agnes Nyandeng','Rebecca Alek'];
    const SSFL = ['Juba','Juba - Tongping','Malakal','Wau'];
    for (let i = 0; i < 4; i++) {
        const n = SSF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(30,45), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'South Sudan', location:SSFL[i%SSFL.length], nationality:'South Sudan', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+211') }); idx++; fIdx++;
    }
    // â•â•â• ETHIOPIA FEMALES (3) â•â•â•
    const ETF = ['Meron Tadesse','Hiwot Bekele','Tigist Hailu'];
    const ETFL = ['Addis Ababa - Bole','Addis Ababa - Kazanchis','Hawassa'];
    for (let i = 0; i < 3; i++) {
        const n = ETF[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(30,45), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Ethiopia', location:ETFL[i%ETFL.length], nationality:'Ethiopia', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+251') }); idx++; fIdx++;
    }
    // Fill remaining female images (up to 116) with MORE Kenya profiles
    const KF2 = ['Gladys Njeri','Millicent Aoko','Peninah Chebet','Tabitha Wangui','Emily Jepkoech','Doreen Muthiga','Stella Wafula','Brenda Achieng','Linda Mwikali','Veronica Bosibori','Naomi Wanjala','Sharon Kerubo','Angela Mwende','Hellen Anyango','Mercy Nekesa','Cynthia Chepkorir','Pamela Adhiambo','Winfred Njoki','Ruth Wambui','Sandra Moraa'];
    while (fIdx <= 116) {
        const n = KF2[(fIdx-101) % KF2.length]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'female', age:randAge(32,52), avatar_url:`/seed-photos/seed-f-${String(fIdx).padStart(3,'0')}.jpg`, country:'Kenya', location:KFL[(fIdx-1)%KFL.length], nationality:'Kenya', bio:pick(FEMALE_BIOS), looking_for:'sugar_daddy', profile_type:'sugar_mummy', phone_number:randPhone('+254') }); idx++; fIdx++;
    }

    // â•â•â• MALE PROFILES (10) â€” seed-m-001 to seed-m-010 â•â•â•
    const KM = ['James Kamau','Peter Odhiambo','David Kipchoge','Samuel Mwangi','Robert Mutua','Joseph Kimani'];
    const KML = ['Nairobi - Lavington','Mombasa - Nyali','Nairobi - Runda','Nairobi - Kileleshwa','Machakos','Naivasha'];
    let mIdx = 1;
    for (let i = 0; i < 6; i++) {
        const n = KM[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'male', age:randAge(40,58), avatar_url:`/seed-photos/seed-m-${String(mIdx).padStart(3,'0')}.jpg`, country:'Kenya', location:KML[i], nationality:'Kenya', bio:pick(MALE_BIOS), looking_for:'sugar_mummy', profile_type:'sugar_daddy', phone_number:randPhone('+254') }); idx++; mIdx++;
    }
    const UM = ['Charles Mukasa','Ronald Kato'];
    const UML = ['Kampala - Bugolobi','Jinja'];
    for (let i = 0; i < 2; i++) {
        const n = UM[i]; profiles.push({ display_name: n, email: `${n.toLowerCase().replace(/[^a-z]/g,'.').replace(/\.+/g,'.')}.s${idx}@gs-seed.app`, gender:'male', age:randAge(42,55), avatar_url:`/seed-photos/seed-m-${String(mIdx).padStart(3,'0')}.jpg`, country:'Uganda', location:UML[i], nationality:'Uganda', bio:pick(MALE_BIOS), looking_for:'sugar_mummy', profile_type:'sugar_daddy', phone_number:randPhone('+256') }); idx++; mIdx++;
    }
    // Tanzania male
    profiles.push({ display_name:'Julius Mwalimu', email:`julius.mwalimu.s${idx}@gs-seed.app`, gender:'male', age:randAge(43,55), avatar_url:`/seed-photos/seed-m-${String(mIdx).padStart(3,'0')}.jpg`, country:'Tanzania', location:'Dar es Salaam - Mikocheni', nationality:'Tanzania', bio:pick(MALE_BIOS), looking_for:'sugar_mummy', profile_type:'sugar_daddy', phone_number:randPhone('+255') }); idx++; mIdx++;
    // Zimbabwe male
    profiles.push({ display_name:'Tendai Chisora', email:`tendai.chisora.s${idx}@gs-seed.app`, gender:'male', age:randAge(44,56), avatar_url:`/seed-photos/seed-m-${String(mIdx).padStart(3,'0')}.jpg`, country:'Zimbabwe', location:'Harare - Borrowdale', nationality:'Zimbabwe', bio:pick(MALE_BIOS), looking_for:'sugar_mummy', profile_type:'sugar_daddy', phone_number:randPhone('+263') }); idx++; mIdx++;

    return profiles;
}

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin.from('users').select('id, display_name, gender, country, is_seed, profile_type, phone_number, bio, age').eq('is_seed', true).order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({
            total: data?.length || 0,
            by_gender: { female: data?.filter(u => u.gender === 'female').length || 0, male: data?.filter(u => u.gender === 'male').length || 0 },
            by_country: data?.reduce((acc, u) => { acc[u.country] = (acc[u.country] || 0) + 1; return acc; }, {}),
        });
    } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE() {
    try {
        const { data: seeds } = await supabaseAdmin.from('users').select('id').eq('is_seed', true);
        const { data: orphans } = await supabaseAdmin.from('users').select('id').like('email', '%@gs-seed.app');
        const all = [...(seeds||[]), ...(orphans||[])];
        const unique = [...new Map(all.map(u => [u.id, u])).values()];
        let deleted = 0;
        for (const u of unique) { const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id); if (!error) deleted++; }
        return NextResponse.json({ success: true, message: `Deleted ${deleted} seed users`, total: unique.length, deleted });
    } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST() {
    try {
        const profiles = buildProfiles();
        const results = { total: profiles.length, created: 0, errors: 0 };
        const errors = [];

        for (const p of profiles) {
            try {
                let userId;
                const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
                    email: p.email, password: 'SeedUser2024!@#', email_confirm: true,
                    user_metadata: { display_name: p.display_name, avatar_url: p.avatar_url, is_seed: true },
                });
                if (authErr) {
                    if (authErr.message?.includes('already been registered')) {
                        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                        const existing = users?.find(u => u.email === p.email);
                        if (existing) userId = existing.id; else { results.errors++; continue; }
                    } else { errors.push({ email: p.email, error: authErr.message }); results.errors++; continue; }
                } else { userId = authUser.user.id; }

                const { error: profileErr } = await supabaseAdmin.from('users').upsert({
                    id: userId, email: p.email, display_name: p.display_name, avatar_url: p.avatar_url,
                    gender: p.gender, age: p.age, bio: p.bio, country: p.country, location: p.location,
                    nationality: p.nationality, looking_for: p.looking_for, profile_type: p.profile_type,
                    phone_number: p.phone_number, is_seed: true, is_online: Math.random() > 0.5, phone_visible: true,
                }, { onConflict: 'id' });
                if (profileErr) { errors.push({ email: p.email, error: profileErr.message }); results.errors++; continue; }
                results.created++;

                if (Math.random() < 0.65) {
                    await supabaseAdmin.from('verification_requests').upsert({ user_id: userId, status: 'verified', document_type: 'selfie', document_url: p.avatar_url, reviewed_at: new Date().toISOString() }, { onConflict: 'user_id' });
                }
                if (Math.random() < 0.55) {
                    const plan = Math.random() > 0.5 ? 'gold' : 'silver';
                    await supabaseAdmin.from('subscriptions').upsert({ user_id: userId, plan, status: 'active', started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 90*86400000).toISOString() }, { onConflict: 'user_id' });
                }
            } catch (e) { errors.push({ email: p.email, error: e.message }); results.errors++; }
        }

        return NextResponse.json({ success: true, message: `Seeded ${results.created}/${results.total} profiles`, results, errors: errors.slice(0, 10) });
    } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
