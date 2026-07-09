const LOCATIONS = [
    [
        "Nairobi",
        "Kenya"
    ],
    [
        "Westlands, Nairobi",
        "Kenya"
    ],
    [
        "Kilimani, Nairobi",
        "Kenya"
    ],
    [
        "Mombasa",
        "Kenya"
    ],
    [
        "Kisumu",
        "Kenya"
    ],
    [
        "Nakuru",
        "Kenya"
    ],
    [
        "Eldoret",
        "Kenya"
    ],
    [
        "Thika",
        "Kenya"
    ],
    [
        "Kampala",
        "Uganda"
    ],
    [
        "Dar es Salaam",
        "Tanzania"
    ],
    [
        "Arusha",
        "Tanzania"
    ],
    [
        "Kigali",
        "Rwanda"
    ],
    [
        "Nyali, Mombasa",
        "Kenya"
    ],
    [
        "Kiambu",
        "Kenya"
    ],
    [
        "Machakos",
        "Kenya"
    ],
    [
        "Kisii",
        "Kenya"
    ]
];

const PROFILES = [
    [
        "Mary Wanjiku",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/135802667_232816518341075_4651762406767829412_n.jpg",
        "mary_wanjiku_seed_001"
    ],
    [
        "Grace Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/309430012_899829531405455_6316980861730521214_n.jpg",
        "grace_achieng_seed_002"
    ],
    [
        "Rose Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/470198948_10213044037012669_7521416294878065559_n.jpg",
        "rose_njeri_seed_003"
    ],
    [
        "Janet Atieno",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/481828748_9692187360792242_9146147282301200415_n.jpg",
        "janet_atieno_seed_004"
    ],
    [
        "Catherine Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/482050306_1147549923783364_926084769166600096_n.jpg",
        "catherine_muthoni_seed_005"
    ],
    [
        "Naomi Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/483366992_950525027250667_4447409627450486013_n.jpg",
        "naomi_chebet_seed_006"
    ],
    [
        "Lilian Nyambura",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/486468615_1368464047634761_9192223350638552489_n.jpg",
        "lilian_nyambura_seed_007"
    ],
    [
        "Tabitha Okello",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/489915792_4086238118367722_2306659618912744023_n.jpg",
        "tabitha_okello_seed_008"
    ],
    [
        "Priscilla Kamau",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/490348140_2796332250554926_2923797969351018021_n.jpg",
        "priscilla_kamau_seed_009"
    ],
    [
        "Sarah Nambooze",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        47,
        "/seed/sugarmums/505716392_122093267600919099_6486887083912745204_n.jpg",
        "sarah_nambooze_seed_010"
    ],
    [
        "Caroline Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        48,
        "/seed/sugarmums/520260083_122115871202919099_1054470779057543978_n.jpg",
        "caroline_wambui_seed_011"
    ],
    [
        "Esther Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        49,
        "/seed/sugarmums/557570564_24730878153242033_3944281669077757632_n.jpg",
        "esther_njeri_seed_012"
    ],
    [
        "Lucy Atieno",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        50,
        "/seed/sugarmums/597845582_2166779967179364_5709871275356995716_n.jpg",
        "lucy_atieno_seed_013"
    ],
    [
        "Mercy Karanja",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        51,
        "/seed/sugarmums/608690528_2653775898340319_5452382960999763839_n.jpg",
        "mercy_karanja_seed_014"
    ],
    [
        "Stella Naliaka",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        52,
        "/seed/sugarmums/617093581_1861784441365248_1200736106140232839_n.jpg",
        "stella_naliaka_seed_015"
    ],
    [
        "Ruth Nyambura",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        53,
        "/seed/sugarmums/657323961_122158546562705544_6177887366667359316_n.jpg",
        "ruth_nyambura_seed_016"
    ],
    [
        "Monica Moraa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        54,
        "/seed/sugarmums/669197569_122161352972906666_6281181448909002135_n.jpg",
        "monica_moraa_seed_017"
    ],
    [
        "Beatrice Awino",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        55,
        "/seed/sugarmums/675016740_122098265858641990_1935120813710734431_n.jpg",
        "beatrice_awino_seed_018"
    ],
    [
        "Alice Mwikali",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        56,
        "/seed/sugarmums/701326447_2161095471413437_1854303804228683325_n.jpg",
        "alice_mwikali_seed_019"
    ],
    [
        "Josephine Akinyi",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        57,
        "/seed/sugarmums/703752375_1002518135456588_2715207885396056794_n.jpg",
        "josephine_akinyi_seed_020"
    ],
    [
        "Margaret Nyambura",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        58,
        "/seed/sugarmums/705748860_122099549895332606_2096928998599311504_n.jpg",
        "margaret_nyambura_seed_021"
    ],
    [
        "Teresa Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/713584441_1022467274071156_8286691533942145522_n.jpg",
        "teresa_achieng_seed_022"
    ],
    [
        "Eunice Kerubo",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/718511776_1558676655675238_8676201244523092997_n.jpg",
        "eunice_kerubo_seed_023"
    ],
    [
        "Anne Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/723961892_122107744329301224_9140850333280468130_n.jpg",
        "anne_wairimu_seed_024"
    ],
    [
        "Nancy Mbithe",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/736683055_122222363156919099_7880249159094850988_n.jpg",
        "nancy_mbithe_seed_025"
    ],
    [
        "Gladys Chepkorir",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/740487608_1050794261238457_4121374967794502451_n.jpg",
        "gladys_chepkorir_seed_026"
    ],
    [
        "Mildred Naliaka",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/photo_3_2026-06-24_14-00-45.jpg",
        "mildred_naliaka_seed_027"
    ],
    [
        "Pamela Atieno",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/photo_3_2026-06-25_14-22-09.jpg",
        "pamela_atieno_seed_028"
    ],
    [
        "Susan Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/photo_4_2026-06-24_14-00-45.jpg",
        "susan_wairimu_seed_029"
    ],
    [
        "Dorothy Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/photo_4_2026-06-25_14-22-09.jpg",
        "dorothy_chebet_seed_030"
    ],
    [
        "Agnes Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        47,
        "/seed/sugarmums/photo_5_2026-06-24_14-00-45.jpg",
        "agnes_muthoni_seed_031"
    ],
    [
        "Hellen Moraa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        48,
        "/seed/sugarmums/photo_9_2026-06-24_14-00-45.jpg",
        "hellen_moraa_seed_032"
    ],
    [
        "Florence Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        49,
        "/seed/sugarmums/photo_10_2026-06-24_14-00-45.jpg",
        "florence_wambui_seed_033"
    ],
    [
        "Jemimah Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        50,
        "/seed/sugarmums/photo_11_2026-06-24_14-00-45.jpg",
        "jemimah_achieng_seed_034"
    ],
    [
        "Christine Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        51,
        "/seed/sugarmums/photo_12_2026-06-24_14-00-45.jpg",
        "christine_njeri_seed_035"
    ],
    [
        "Rebecca Kamau",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        52,
        "/seed/sugarmums/photo_12_2026-06-25_14-22-09.jpg",
        "rebecca_kamau_seed_036"
    ],
    [
        "Yvonne Akoth",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        53,
        "/seed/sugarmums/photo_13_2026-06-24_14-00-45.jpg",
        "yvonne_akoth_seed_037"
    ],
    [
        "Pauline Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        54,
        "/seed/sugarmums/photo_14_2026-06-24_14-00-45.jpg",
        "pauline_njeri_seed_038"
    ],
    [
        "Angela Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        55,
        "/seed/sugarmums/photo_15_2026-06-24_14-00-45.jpg",
        "angela_muthoni_seed_039"
    ],
    [
        "Roseline Wanjiru",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        56,
        "/seed/sugarmums/photo_16_2026-06-24_14-00-45.jpg",
        "roseline_wanjiru_seed_040"
    ],
    [
        "Joyce Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        57,
        "/seed/sugarmums/photo_17_2026-06-24_14-00-45.jpg",
        "joyce_wambui_seed_041"
    ],
    [
        "Elizabeth Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        58,
        "/seed/sugarmums/photo_18_2026-06-24_14-00-45.jpg",
        "elizabeth_wairimu_seed_042"
    ],
    [
        "Martha Kariuki",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/photo_19_2026-06-24_14-00-45.jpg",
        "martha_kariuki_seed_043"
    ],
    [
        "Naomi Nambooze",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/photo_20_2026-06-24_14-00-45.jpg",
        "naomi_nambooze_seed_044"
    ],
    [
        "Priscilla Nkurunziza",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/photo_22_2026-06-24_14-00-45.jpg",
        "priscilla_nkurunziza_seed_045"
    ],
    [
        "Sarah Okello",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/photo_23_2026-06-24_14-00-45.jpg",
        "sarah_okello_seed_046"
    ],
    [
        "Tabitha Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/photo_24_2026-06-24_14-00-45.jpg",
        "tabitha_chebet_seed_047"
    ],
    [
        "Wairimu Johnson",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/photo_26_2026-06-24_14-00-45.jpg",
        "wairimu_johnson_seed_048"
    ],
    [
        "Yolanda Taylor",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/photo_27_2026-06-24_14-00-45.jpg",
        "yolanda_taylor_seed_049"
    ],
    [
        "Zipporah Wanjiku",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/photo_28_2026-06-24_14-00-45.jpg",
        "zipporah_wanjiku_seed_050"
    ],
    [
        "Margaret Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/photo_29_2026-06-24_14-00-45.jpg",
        "margaret_achieng_seed_051"
    ],
    [
        "Catherine Nabwire",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        47,
        "/seed/sugarmums/photo_30_2026-06-24_14-00-45.jpg",
        "catherine_nabwire_seed_052"
    ],
    [
        "Janet Mugisha",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        48,
        "/seed/sugarmums/photo_31_2026-06-24_14-00-45.jpg",
        "janet_mugisha_seed_053"
    ],
    [
        "Rosemary Hassan",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        49,
        "/seed/sugarmums/photo_31_2026-06-25_14-21-42.jpg",
        "rosemary_hassan_seed_054"
    ],
    [
        "Winnie Atieno",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        50,
        "/seed/sugarmums/photo_32_2026-06-24_14-00-45.jpg",
        "winnie_atieno_seed_055"
    ],
    [
        "Peninah Karanja",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        51,
        "/seed/sugarmums/photo_32_2026-06-25_14-21-42.jpg",
        "peninah_karanja_seed_056"
    ],
    [
        "Damaris Wanjiku",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        52,
        "/seed/sugarmums/photo_33_2026-06-24_14-00-45.jpg",
        "damaris_wanjiku_seed_057"
    ],
    [
        "Violet Naliaka",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        53,
        "/seed/sugarmums/photo_33_2026-06-25_14-21-42.jpg",
        "violet_naliaka_seed_058"
    ],
    [
        "Regina Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        54,
        "/seed/sugarmums/photo_34_2026-06-24_14-00-45.jpg",
        "regina_wambui_seed_059"
    ],
    [
        "Jacinta Moraa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        55,
        "/seed/sugarmums/photo_34_2026-06-25_14-21-42.jpg",
        "jacinta_moraa_seed_060"
    ],
    [
        "Eunice Akinyi",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        56,
        "/seed/sugarmums/photo_35_2026-06-24_14-00-45.jpg",
        "eunice_akinyi_seed_061"
    ],
    [
        "Clara Kamau",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        57,
        "/seed/sugarmums/photo_35_2026-06-25_14-21-42.jpg",
        "clara_kamau_seed_062"
    ],
    [
        "Irene Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        58,
        "/seed/sugarmums/photo_36_2026-06-24_14-00-45.jpg",
        "irene_njeri_seed_063"
    ],
    [
        "Leah Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/photo_37_2026-06-24_14-00-45.jpg",
        "leah_chebet_seed_064"
    ],
    [
        "Millicent Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/photo_38_2026-06-25_14-21-42.jpg",
        "millicent_wairimu_seed_065"
    ],
    [
        "Nelly Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/photo_41_2026-06-25_14-21-42.jpg",
        "nelly_muthoni_seed_066"
    ],
    [
        "Purity Wanjiku",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/photo_42_2026-06-25_14-21-42.jpg",
        "purity_wanjiku_seed_067"
    ],
    [
        "Lydia Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/photo_43_2026-06-25_14-21-42.jpg",
        "lydia_achieng_seed_068"
    ],
    [
        "Vera Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/photo_44_2026-06-25_14-21-42.jpg",
        "vera_njeri_seed_069"
    ],
    [
        "Edith Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/photo_46_2026-06-25_14-21-42.jpg",
        "edith_wambui_seed_070"
    ],
    [
        "Jane Atieno",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/photo_47_2026-06-25_14-21-42.jpg",
        "jane_atieno_seed_071"
    ],
    [
        "Maggie Kamau",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/photo_48_2026-06-25_14-21-42.jpg",
        "maggie_kamau_seed_072"
    ],
    [
        "Sally Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        47,
        "/seed/sugarmums/photo_49_2026-06-25_14-21-42.jpg",
        "sally_chebet_seed_073"
    ],
    [
        "Cecilia Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        48,
        "/seed/sugarmums/photo_51_2026-06-25_14-21-42.jpg",
        "cecilia_wairimu_seed_074"
    ],
    [
        "Phoebe Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        49,
        "/seed/sugarmums/photo_52_2026-06-25_14-21-42.jpg",
        "phoebe_muthoni_seed_075"
    ],
    [
        "Judith Karanja",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        50,
        "/seed/sugarmums/photo_53_2026-06-25_14-21-42.jpg",
        "judith_karanja_seed_076"
    ],
    [
        "Anita Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        51,
        "/seed/sugarmums/photo_54_2026-06-25_14-21-42.jpg",
        "anita_njeri_seed_077"
    ],
    [
        "Diana Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        52,
        "/seed/sugarmums/photo_55_2026-06-25_14-21-42.jpg",
        "diana_wambui_seed_078"
    ],
    [
        "Betty Akoth",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        53,
        "/seed/sugarmums/photo_56_2026-06-25_14-21-42.jpg",
        "betty_akoth_seed_079"
    ],
    [
        "Eva Wanjiku",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        54,
        "/seed/sugarmums/photo_57_2026-06-25_14-21-42.jpg",
        "eva_wanjiku_seed_080"
    ],
    [
        "Harriet Moraa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        55,
        "/seed/sugarmums/photo_58_2026-06-25_14-21-42.jpg",
        "harriet_moraa_seed_081"
    ],
    [
        "Selina Achieng",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        56,
        "/seed/sugarmums/photo_59_2026-06-25_14-21-42.jpg",
        "selina_achieng_seed_082"
    ],
    [
        "Rachael Chebet",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        57,
        "/seed/sugarmums/photo_61_2026-06-25_14-21-42.jpg",
        "rachael_chebet_seed_083"
    ],
    [
        "Miriam Wairimu",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        58,
        "/seed/sugarmums/photo_63_2026-06-25_14-21-42.jpg",
        "miriam_wairimu_seed_084"
    ],
    [
        "Nora Njeri",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/photo_64_2026-06-25_14-21-42.jpg",
        "nora_njeri_seed_085"
    ],
    [
        "Vivian Kamau",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/photo_66_2026-06-25_14-21-42.jpg",
        "vivian_kamau_seed_086"
    ],
    [
        "Lorna Muthoni",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/photo_68_2026-06-25_14-21-42.jpg",
        "lorna_muthoni_seed_087"
    ],
    [
        "Ivy Wambui",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/photo_69_2026-06-25_14-21-42.jpg",
        "ivy_wambui_seed_088"
    ],
    [
        "Sandra Akinyi",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/photo_70_2026-06-25_14-21-42.jpg",
        "sandra_akinyi_seed_089"
    ],
    [
        "Caren Wanjiru",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/photo_71_2026-06-25_14-21-42.jpg",
        "caren_wanjiru_seed_090"
    ],
    [
        "Dorcas Cherotich",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/photo_72_2026-06-25_14-21-42.jpg",
        "dorcas_cherotich_seed_091"
    ],
    [
        "Abigail Omollo",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/photo_73_2026-06-25_14-21-42.jpg",
        "abigail_omollo_seed_092"
    ],
    [
        "Charity Wangeci",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/photo_74_2026-06-25_14-21-42.jpg",
        "charity_wangeci_seed_093"
    ],
    [
        "Daphne Mukami",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        47,
        "/seed/sugarmums/photo_76_2026-06-25_14-21-42.jpg",
        "daphne_mukami_seed_094"
    ],
    [
        "Emily Kemunto",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        48,
        "/seed/sugarmums/photo_77_2026-06-25_14-21-42.jpg",
        "emily_kemunto_seed_095"
    ],
    [
        "Felistus Jepchirchir",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        49,
        "/seed/sugarmums/photo_78_2026-06-25_14-21-42.jpg",
        "felistus_jepchirchir_seed_096"
    ],
    [
        "Gladys Nyokabi",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        50,
        "/seed/sugarmums/photo_79_2026-06-25_14-21-42.jpg",
        "gladys_nyokabi_seed_097"
    ],
    [
        "Hope Nafula",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        51,
        "/seed/sugarmums/photo_80_2026-06-25_14-21-42.jpg",
        "hope_nafula_seed_098"
    ],
    [
        "Immaculate Wangari",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        52,
        "/seed/sugarmums/photo_82_2026-06-25_14-21-42.jpg",
        "immaculate_wangari_seed_099"
    ],
    [
        "Jennifer Mwende",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        53,
        "/seed/sugarmums/photo_83_2026-06-25_14-21-42.jpg",
        "jennifer_mwende_seed_100"
    ],
    [
        "Kerubo Bosibori",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        54,
        "/seed/sugarmums/photo_85_2026-06-25_14-21-42.jpg",
        "kerubo_bosibori_seed_101"
    ],
    [
        "Louisa Nekesa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        55,
        "/seed/sugarmums/photo_86_2026-06-25_14-21-42.jpg",
        "louisa_nekesa_seed_102"
    ],
    [
        "Melissa Njoki",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        56,
        "/seed/sugarmums/photo_87_2026-06-25_14-21-42.jpg",
        "melissa_njoki_seed_103"
    ],
    [
        "Nadia Chepngetich",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        57,
        "/seed/sugarmums/photo_88_2026-06-25_14-21-42.jpg",
        "nadia_chepngetich_seed_104"
    ],
    [
        "Olive Wacera",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        58,
        "/seed/sugarmums/photo_89_2026-06-25_14-21-42.jpg",
        "olive_wacera_seed_105"
    ],
    [
        "Peris Chemtai",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        38,
        "/seed/sugarmums/photo_90_2026-06-25_14-21-42.jpg",
        "peris_chemtai_seed_106"
    ],
    [
        "Queeneth Aoko",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        39,
        "/seed/sugarmums/photo_91_2026-06-25_14-21-42.jpg",
        "queeneth_aoko_seed_107"
    ],
    [
        "Risper Mwikali",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        40,
        "/seed/sugarmums/photo_93_2026-06-25_14-21-42.jpg",
        "risper_mwikali_seed_108"
    ],
    [
        "Siphiwe Kanini",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        41,
        "/seed/sugarmums/photo_94_2026-06-25_14-21-42.jpg",
        "siphiwe_kanini_seed_109"
    ],
    [
        "Truphena Jepkosgei",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        42,
        "/seed/sugarmums/photo_95_2026-06-25_14-21-42.jpg",
        "truphena_jepkosgei_seed_110"
    ],
    [
        "Ursula Makena",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        43,
        "/seed/sugarmums/photo_96_2026-06-25_14-21-42.jpg",
        "ursula_makena_seed_111"
    ],
    [
        "Veronicah Nyakerario",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        44,
        "/seed/sugarmums/photo_97_2026-06-25_14-21-42.jpg",
        "veronicah_nyakerario_seed_112"
    ],
    [
        "Winfridah Mwendwa",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        45,
        "/seed/sugarmums/photo_98_2026-06-25_14-21-42.jpg",
        "winfridah_mwendwa_seed_113"
    ],
    [
        "Ximena Adhiambo",
        "sugar_mummy",
        "Sugar Guy / Toyboy",
        46,
        "/seed/sugarmums/photo_100_2026-06-25_14-21-42.jpg",
        "ximena_adhiambo_seed_114"
    ],
    [
        "James Kamau",
        "sugar_daddy",
        "Mistress",
        50,
        "/seed/sugar-dads/41257846_2112355202159253_7655290983302561792_n.jpg",
        "james_kamau_seed_115"
    ],
    [
        "Joseph Kimani",
        "sugar_daddy",
        "Mistress",
        51,
        "/seed/sugar-dads/50701215_2434726876540671_8351971014137085952_n.jpg",
        "joseph_kimani_seed_116"
    ],
    [
        "Peter Mwangi",
        "sugar_daddy",
        "Mistress",
        52,
        "/seed/sugar-dads/94259878_907015356386025_2139282575452012544_n.jpg",
        "peter_mwangi_seed_117"
    ],
    [
        "Samuel Otieno",
        "sugar_daddy",
        "Mistress",
        53,
        "/seed/sugar-dads/242242620_3003976443264325_7057723201560579980_n.jpg",
        "samuel_otieno_seed_118"
    ],
    [
        "David Karanja",
        "sugar_daddy",
        "Mistress",
        54,
        "/seed/sugar-dads/258363287_642464800111112_7846660447287910233_n.jpg",
        "david_karanja_seed_119"
    ],
    [
        "Patrick Njoroge",
        "sugar_daddy",
        "Mistress",
        55,
        "/seed/sugar-dads/263828950_5489973297686170_2006043835249403004_n.jpg",
        "patrick_njoroge_seed_120"
    ],
    [
        "George Mutua",
        "sugar_daddy",
        "Mistress",
        56,
        "/seed/sugar-dads/314403892_5727900670604550_6773676234752562194_n.jpg",
        "george_mutua_seed_121"
    ],
    [
        "Daniel Wekesa",
        "sugar_daddy",
        "Mistress",
        57,
        "/seed/sugar-dads/394576689_24498032769788175_7998968306869213240_n.jpg",
        "daniel_wekesa_seed_122"
    ],
    [
        "Martin Kariuki",
        "sugar_daddy",
        "Mistress",
        58,
        "/seed/sugar-dads/453034362_2467015913495608_7283930310197554914_n.jpg",
        "martin_kariuki_seed_123"
    ],
    [
        "Anthony Kiplagat",
        "sugar_daddy",
        "Mistress",
        59,
        "/seed/sugar-dads/463313793_2304876736512525_9216310237095399707_n.jpg",
        "anthony_kiplagat_seed_124"
    ],
    [
        "Robert Omondi",
        "sugar_daddy",
        "Mistress",
        60,
        "/seed/sugar-dads/466977905_9712694358756876_5919785832607405453_n.jpg",
        "robert_omondi_seed_125"
    ],
    [
        "Michael Barasa",
        "sugar_daddy",
        "Mistress",
        61,
        "/seed/sugar-dads/467854637_9606494076044602_5800314901002469296_n.jpg",
        "michael_barasa_seed_126"
    ],
    [
        "Charles Mwaura",
        "sugar_daddy",
        "Mistress",
        62,
        "/seed/sugar-dads/473741970_615764807870525_3671156898059927937_n.jpg",
        "charles_mwaura_seed_127"
    ],
    [
        "Vincent Odhiambo",
        "sugar_daddy",
        "Mistress",
        63,
        "/seed/sugar-dads/491812908_2655433714654142_1987902425268145873_n.jpg",
        "vincent_odhiambo_seed_128"
    ],
    [
        "Richard Kiptoo",
        "sugar_daddy",
        "Mistress",
        64,
        "/seed/sugar-dads/497836800_2412098999146774_7915256882351396435_n.jpg",
        "richard_kiptoo_seed_129"
    ],
    [
        "Edward Ndirangu",
        "sugar_daddy",
        "Mistress",
        50,
        "/seed/sugar-dads/500135567_10237431603956242_5995436218355019998_n.jpg",
        "edward_ndirangu_seed_130"
    ],
    [
        "Francis Onyango",
        "sugar_daddy",
        "Mistress",
        51,
        "/seed/sugar-dads/514347495_24007409768950190_5098126307413510932_n.jpg",
        "francis_onyango_seed_131"
    ],
    [
        "Kenneth Muriithi",
        "sugar_daddy",
        "Mistress",
        52,
        "/seed/sugar-dads/584787828_25641633405429378_997665107127656538_n.jpg",
        "kenneth_muriithi_seed_132"
    ],
    [
        "Victor Mboya",
        "sugar_daddy",
        "Mistress",
        53,
        "/seed/sugar-dads/597888605_122095971903170439_8573247826245878_n.jpg",
        "victor_mboya_seed_133"
    ],
    [
        "Stephen Kariuki",
        "sugar_daddy",
        "Mistress",
        54,
        "/seed/sugar-dads/599931720_1542919673700277_251870417764077799_n.jpg",
        "stephen_kariuki_seed_134"
    ],
    [
        "Alex Muthomi",
        "sugar_daddy",
        "Mistress",
        55,
        "/seed/sugar-dads/637208495_4275155796064985_3521695875460663981_n.jpg",
        "alex_muthomi_seed_135"
    ],
    [
        "Collins Barasa",
        "sugar_daddy",
        "Mistress",
        56,
        "/seed/sugar-dads/647131110_122093448477078175_3988978000348670931_n.jpg",
        "collins_barasa_seed_136"
    ],
    [
        "Moses Onyango",
        "sugar_daddy",
        "Mistress",
        57,
        "/seed/sugar-dads/655907218_2103598053548602_4940292781353517147_n.jpg",
        "moses_onyango_seed_137"
    ],
    [
        "Isaac Mutiso",
        "sugar_daddy",
        "Mistress",
        58,
        "/seed/sugar-dads/675053104_2436551233453055_6514091109646884975_n.jpg",
        "isaac_mutiso_seed_138"
    ],
    [
        "Emmanuel Wekesa",
        "sugar_daddy",
        "Mistress",
        59,
        "/seed/sugar-dads/685901249_26494579890193728_29068121741521313_n.jpg",
        "emmanuel_wekesa_seed_139"
    ],
    [
        "Fredrick Otieno",
        "sugar_daddy",
        "Mistress",
        60,
        "/seed/sugar-dads/688033819_26633743339569982_1422638662943907309_n.jpg",
        "fredrick_otieno_seed_140"
    ],
    [
        "Caleb Mwangi",
        "sugar_daddy",
        "Mistress",
        61,
        "/seed/sugar-dads/692578701_947625688104359_2117109891084173030_n.jpg",
        "caleb_mwangi_seed_141"
    ],
    [
        "Benard Kiptoo",
        "sugar_daddy",
        "Mistress",
        62,
        "/seed/sugar-dads/701681554_26928160640147206_204497892137000249_n.jpg",
        "benard_kiptoo_seed_142"
    ],
    [
        "Lawrence Muriuki",
        "sugar_daddy",
        "Mistress",
        63,
        "/seed/sugar-dads/716765718_10215159758503579_8717220153331554610_n.jpg",
        "lawrence_muriuki_seed_143"
    ],
    [
        "Simon Karanja",
        "sugar_daddy",
        "Mistress",
        64,
        "/seed/sugar-dads/720919828_2894019484263240_2907882802674018566_n.jpg",
        "simon_karanja_seed_144"
    ],
    [
        "Dennis Mutua",
        "sugar_daddy",
        "Mistress",
        50,
        "/seed/sugar-dads/photo_5_2026-06-25_14-22-09.jpg",
        "dennis_mutua_seed_145"
    ],
    [
        "Albert Ochieng",
        "sugar_daddy",
        "Mistress",
        51,
        "/seed/sugar-dads/photo_6_2026-06-25_14-22-09.jpg",
        "albert_ochieng_seed_146"
    ],
    [
        "Phillip Njoroge",
        "sugar_daddy",
        "Mistress",
        52,
        "/seed/sugar-dads/photo_7_2026-06-25_14-22-09.jpg",
        "phillip_njoroge_seed_147"
    ],
    [
        "Henry Kiprono",
        "sugar_daddy",
        "Mistress",
        53,
        "/seed/sugar-dads/photo_8_2026-06-25_14-22-09.jpg",
        "henry_kiprono_seed_148"
    ],
    [
        "Nelson Wekesa",
        "sugar_daddy",
        "Mistress",
        54,
        "/seed/sugar-dads/photo_9_2026-06-25_14-22-09.jpg",
        "nelson_wekesa_seed_149"
    ],
    [
        "Brian Mwangi",
        "sugar_daddy",
        "Mistress",
        55,
        "/seed/sugar-dads/photo_10_2026-06-25_14-22-09.jpg",
        "brian_mwangi_seed_150"
    ],
    [
        "Arthur Kamau",
        "sugar_daddy",
        "Mistress",
        56,
        "/seed/sugar-dads/photo_11_2026-06-25_14-22-09.jpg",
        "arthur_kamau_seed_151"
    ],
    [
        "Oscar Otieno",
        "sugar_daddy",
        "Mistress",
        57,
        "/seed/sugar-dads/photo_13_2026-06-25_14-22-09.jpg",
        "oscar_otieno_seed_152"
    ],
    [
        "Leonard Kibet",
        "sugar_daddy",
        "Mistress",
        58,
        "/seed/sugar-dads/photo_14_2026-06-25_14-22-09.jpg",
        "leonard_kibet_seed_153"
    ],
    [
        "Paul Kariuki",
        "sugar_daddy",
        "Mistress",
        59,
        "/seed/sugar-dads/photo_15_2026-06-25_14-22-09.jpg",
        "paul_kariuki_seed_154"
    ],
    [
        "Wilson Odhiambo",
        "sugar_daddy",
        "Mistress",
        60,
        "/seed/sugar-dads/photo_16_2026-06-25_14-22-09.jpg",
        "wilson_odhiambo_seed_155"
    ],
    [
        "Evans Mutiso",
        "sugar_daddy",
        "Mistress",
        61,
        "/seed/sugar-dads/photo_17_2026-06-25_14-22-09.jpg",
        "evans_mutiso_seed_156"
    ],
    [
        "Gabriel Ndirangu",
        "sugar_daddy",
        "Mistress",
        62,
        "/seed/sugar-dads/photo_18_2026-06-25_14-22-09.jpg",
        "gabriel_ndirangu_seed_157"
    ],
    [
        "Nicholas Barasa",
        "sugar_daddy",
        "Mistress",
        63,
        "/seed/sugar-dads/photo_19_2026-06-25_14-22-09.jpg",
        "nicholas_barasa_seed_158"
    ],
    [
        "Raymond Kimani",
        "sugar_daddy",
        "Mistress",
        64,
        "/seed/sugar-dads/photo_20_2026-06-25_14-22-09.jpg",
        "raymond_kimani_seed_159"
    ],
    [
        "Solomon Kigen",
        "sugar_daddy",
        "Mistress",
        50,
        "/seed/sugar-dads/photo_21_2026-06-25_14-22-09.jpg",
        "solomon_kigen_seed_160"
    ],
    [
        "Andrew Mwenda",
        "sugar_daddy",
        "Mistress",
        51,
        "/seed/sugar-dads/photo_22_2026-06-25_14-22-09.jpg",
        "andrew_mwenda_seed_161"
    ],
    [
        "Godfrey Ouma",
        "sugar_daddy",
        "Mistress",
        52,
        "/seed/sugar-dads/photo_23_2026-06-25_14-22-09.jpg",
        "godfrey_ouma_seed_162"
    ],
    [
        "Julius Chepkwony",
        "sugar_daddy",
        "Mistress",
        53,
        "/seed/sugar-dads/photo_24_2026-06-25_14-22-09.jpg",
        "julius_chepkwony_seed_163"
    ],
    [
        "Stanley Macharia",
        "sugar_daddy",
        "Mistress",
        54,
        "/seed/sugar-dads/photo_25_2026-06-25_14-22-09.jpg",
        "stanley_macharia_seed_164"
    ],
    [
        "Ronald Mulinge",
        "sugar_daddy",
        "Mistress",
        55,
        "/seed/sugar-dads/photo_26_2026-06-25_14-22-09.jpg",
        "ronald_mulinge_seed_165"
    ],
    [
        "Clifford Nyambane",
        "sugar_daddy",
        "Mistress",
        56,
        "/seed/sugar-dads/photo_27_2026-06-25_14-22-09.jpg",
        "clifford_nyambane_seed_166"
    ],
    [
        "Douglas Korir",
        "sugar_daddy",
        "Mistress",
        57,
        "/seed/sugar-dads/photo_28_2026-06-25_14-22-09.jpg",
        "douglas_korir_seed_167"
    ],
    [
        "Walter Simiyu",
        "sugar_daddy",
        "Mistress",
        58,
        "/seed/sugar-dads/photo_39_2026-06-24_14-00-45.jpg",
        "walter_simiyu_seed_168"
    ],
    [
        "Edwin Ngetich",
        "sugar_daddy",
        "Mistress",
        59,
        "/seed/sugar-dads/photo_40_2026-06-24_14-00-45.jpg",
        "edwin_ngetich_seed_169"
    ],
    [
        "Allan Makori",
        "sugar_daddy",
        "Mistress",
        60,
        "/seed/sugar-dads/photo_41_2026-06-24_14-00-45.jpg",
        "allan_makori_seed_170"
    ],
    [
        "Gilbert Wafula",
        "sugar_daddy",
        "Mistress",
        61,
        "/seed/sugar-dads/photo_42_2026-06-24_14-00-45.jpg",
        "gilbert_wafula_seed_171"
    ],
    [
        "Tom Muthomi",
        "sugar_daddy",
        "Mistress",
        62,
        "/seed/sugar-dads/photo_43_2026-06-24_14-00-45.jpg",
        "tom_muthomi_seed_172"
    ],
    [
        "Cyrus Maina",
        "sugar_daddy",
        "Mistress",
        63,
        "/seed/sugar-dads/photo_44_2026-06-24_14-00-45.jpg",
        "cyrus_maina_seed_173"
    ],
    [
        "Dominic Kipsang",
        "sugar_daddy",
        "Mistress",
        64,
        "/seed/sugar-dads/photo_45_2026-06-24_14-00-45.jpg",
        "dominic_kipsang_seed_174"
    ],
    [
        "Harrison Kioko",
        "sugar_daddy",
        "Mistress",
        50,
        "/seed/sugar-dads/photo_46_2026-06-24_14-00-45.jpg",
        "harrison_kioko_seed_175"
    ],
    [
        "Morris Oluoch",
        "sugar_daddy",
        "Mistress",
        51,
        "/seed/sugar-dads/photo_47_2026-06-24_14-00-45.jpg",
        "morris_oluoch_seed_176"
    ],
    [
        "Gideon Manyara",
        "sugar_daddy",
        "Mistress",
        52,
        "/seed/sugar-dads/photo_48_2026-06-24_14-00-45.jpg",
        "gideon_manyara_seed_177"
    ],
    [
        "Felix Musyoka",
        "sugar_daddy",
        "Mistress",
        53,
        "/seed/sugar-dads/photo_49_2026-06-24_14-00-45.jpg",
        "felix_musyoka_seed_178"
    ],
    [
        "Bernard Kosgei",
        "sugar_daddy",
        "Mistress",
        54,
        "/seed/sugar-dads/photo_50_2026-06-24_14-00-45.jpg",
        "bernard_kosgei_seed_179"
    ],
    [
        "Kelvin Gichuki",
        "sugar_daddy",
        "Mistress",
        55,
        "/seed/sugar-dads/photo_51_2026-06-24_14-00-45.jpg",
        "kelvin_gichuki_seed_180"
    ],
    [
        "Samson Njenga",
        "sugar_daddy",
        "Mistress",
        56,
        "/seed/sugar-dads/photo_52_2026-06-24_14-00-45.jpg",
        "samson_njenga_seed_181"
    ],
    [
        "Mark Ouma",
        "sugar_daddy",
        "Mistress",
        57,
        "/seed/sugar-dads/photo_53_2026-06-24_14-00-45.jpg",
        "mark_ouma_seed_182"
    ],
    [
        "Geoffrey Nasimiyu",
        "sugar_daddy",
        "Mistress",
        58,
        "/seed/sugar-dads/photo_54_2026-06-24_14-00-45.jpg",
        "geoffrey_nasimiyu_seed_183"
    ],
    [
        "Tony Wambua",
        "sugar_daddy",
        "Mistress",
        59,
        "/seed/sugar-dads/photo_55_2026-06-24_14-00-45.jpg",
        "tony_wambua_seed_184"
    ],
    [
        "Philip Kipchumba",
        "sugar_daddy",
        "Mistress",
        60,
        "/seed/sugar-dads/photo_56_2026-06-24_14-00-45.jpg",
        "philip_kipchumba_seed_185"
    ],
    [
        "Timothy Mwirigi",
        "sugar_daddy",
        "Mistress",
        61,
        "/seed/sugar-dads/photo_57_2026-06-24_14-00-45.jpg",
        "timothy_mwirigi_seed_186"
    ],
    [
        "Jackson Oduor",
        "sugar_daddy",
        "Mistress",
        62,
        "/seed/sugar-dads/photo_58_2026-06-24_14-00-45.jpg",
        "jackson_oduor_seed_187"
    ],
    [
        "Marcus Cheruiyot",
        "sugar_daddy",
        "Mistress",
        63,
        "/seed/sugar-dads/photo_59_2026-06-24_14-00-45.jpg",
        "marcus_cheruiyot_seed_188"
    ],
    [
        "Amos Kipchoge",
        "sugar_daddy",
        "Mistress",
        64,
        "/seed/sugar-dads/photo_60_2026-06-24_14-00-45.jpg",
        "amos_kipchoge_seed_189"
    ],
    [
        "Aisha Kamau",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/42497109_1348421905288925_7895963195175600128_n.jpg",
        "aisha_kamau_seed_190"
    ],
    [
        "Brenda Kariuki",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/281396441_115343687846899_8446623199196456088_n.jpg",
        "brenda_kariuki_seed_191"
    ],
    [
        "Cynthia Nambooze",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/295333399_101880779286216_6132686753201985295_n.jpg",
        "cynthia_nambooze_seed_192"
    ],
    [
        "Diana Nkurunziza",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/298729311_1938459959877547_8634146255512187900_n.jpg",
        "diana_nkurunziza_seed_193"
    ],
    [
        "Evelyn Okello",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/313034444_803355480887865_7925127252451751272_n.jpg",
        "evelyn_okello_seed_194"
    ],
    [
        "Faith Chebet",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/391648916_1350342972544731_4762844462640681975_n.jpg",
        "faith_chebet_seed_195"
    ],
    [
        "Irene Wairimu",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/438081638_122170711598030929_5556897722474503485_n.jpg",
        "irene_wairimu_seed_196"
    ],
    [
        "Joyce Njeri",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/453871891_2221071044928827_6733887042153691187_n.jpg",
        "joyce_njeri_seed_197"
    ],
    [
        "Miriam Achieng",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/460498094_8684983991534006_3429521717736272347_n.jpg",
        "miriam_achieng_seed_198"
    ],
    [
        "Norah Kamene",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/472668706_1983195788845482_5825301630345344697_n.jpg",
        "norah_kamene_seed_199"
    ],
    [
        "Patricia Chebet",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/475015902_608194515479673_4288070670777329007_n.jpg",
        "patricia_chebet_seed_200"
    ],
    [
        "Veronica Moraa",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/475017575_998949112267444_354208393104217499_n.jpg",
        "veronica_moraa_seed_201"
    ],
    [
        "Sharon Wanjiru",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/482265969_641884368309549_1756986394725529414_n.jpg",
        "sharon_wanjiru_seed_202"
    ],
    [
        "Doreen Akoth",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/489859402_4177094715949438_7264101656488937266_n.jpg",
        "doreen_akoth_seed_203"
    ],
    [
        "Lydia Mwikali",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/499879541_24007286065530089_984623504652160163_n.jpg",
        "lydia_mwikali_seed_204"
    ],
    [
        "Gloria Njeri",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/505379852_3121091091372916_7258459909297574307_n.jpg",
        "gloria_njeri_seed_205"
    ],
    [
        "Esther Nyambura",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/518271593_706235432225489_2335429653272571602_n.jpg",
        "esther_nyambura_seed_206"
    ],
    [
        "Nancy Achieng",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/530319318_770806402062374_4548592683622560553_n.jpg",
        "nancy_achieng_seed_207"
    ],
    [
        "Sheila Wambui",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/538919908_1388314536633541_7406826851020490932_n.jpg",
        "sheila_wambui_seed_208"
    ],
    [
        "Ruth Kamau",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/546404479_122093965881026372_7589388880517281363_n.jpg",
        "ruth_kamau_seed_209"
    ],
    [
        "Monica Atieno",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/556433101_122099683833045417_1664075096193654108_n.jpg",
        "monica_atieno_seed_210"
    ],
    [
        "Caroline Chebet",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/574572848_1531888421342873_5980079392085417528_n.jpg",
        "caroline_chebet_seed_211"
    ],
    [
        "Stacy Moraa",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/577026803_4228471877437603_7680613245063539294_n.jpg",
        "stacy_moraa_seed_212"
    ],
    [
        "Wendy Muthoni",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/588604566_122103037611130679_2170833864228479211_n.jpg",
        "wendy_muthoni_seed_213"
    ],
    [
        "Angela Wanjiku",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/590389688_1179147381031162_3048940065860644863_n.jpg",
        "angela_wanjiku_seed_214"
    ],
    [
        "Rachael Naliaka",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/591728857_3748877541916554_8052506975923038275_n.jpg",
        "rachael_naliaka_seed_215"
    ],
    [
        "Mercy Akinyi",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/594669234_2259383447872673_4019959102496371614_n.jpg",
        "mercy_akinyi_seed_216"
    ],
    [
        "Hellen Wairimu",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/616012747_845624581619906_5896937621851689802_n.jpg",
        "hellen_wairimu_seed_217"
    ],
    [
        "Tracy Karanja",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/627683954_1944851026458304_6930120448691553135_n.jpg",
        "tracy_karanja_seed_218"
    ],
    [
        "Faith Wambui",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/628895413_122119697145148992_3159206714546916377_n.jpg",
        "faith_wambui_seed_219"
    ],
    [
        "Pauline Njeri",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/634378039_2091257094956369_7674959165697047178_n.jpg",
        "pauline_njeri_seed_220"
    ],
    [
        "Naomi Atieno",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/655955969_2116048115819658_90118596502563998_n.jpg",
        "naomi_atieno_seed_221"
    ],
    [
        "Betty Chepkemoi",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/698754648_2239144526823279_2762366442055266093_n.jpg",
        "betty_chepkemoi_seed_222"
    ],
    [
        "Linda Muthoni",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/698782687_1496645391952115_868138213137875433_n.jpg",
        "linda_muthoni_seed_223"
    ],
    [
        "Catherine Moraa",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/701216606_4302876096709076_4054478668638912400_n.jpg",
        "catherine_moraa_seed_224"
    ],
    [
        "Susan Wanjiru",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/704802079_888384694266297_7164439445175025436_n.jpg",
        "susan_wanjiru_seed_225"
    ],
    [
        "Violet Achieng",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/718221841_2922289364776887_4089358727003346678_n.jpg",
        "violet_achieng_seed_226"
    ],
    [
        "Janet Kamau",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/718964704_1974709580081422_6120143434556516189_n.jpg",
        "janet_kamau_seed_227"
    ],
    [
        "Milly Wairimu",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/720814562_2231926290877670_8276125276330041474_n.jpg",
        "milly_wairimu_seed_228"
    ],
    [
        "Sally Njeri",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/725684600_1401637271848929_5668482310453032107_n.jpg",
        "sally_njeri_seed_229"
    ],
    [
        "Edith Akoth",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/725689909_1290098669906533_5428839390911928141_n.jpg",
        "edith_akoth_seed_230"
    ],
    [
        "Caren Muthoni",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/726427271_2906447773030362_3661428438374180938_n.jpg",
        "caren_muthoni_seed_231"
    ],
    [
        "Ivy Wambui",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/728503334_996758729620262_4935864933008518718_n.jpg",
        "ivy_wambui_seed_232"
    ],
    [
        "Sandra Chebet",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/730413878_2447293829076406_265011329364516963_n.jpg",
        "sandra_chebet_seed_233"
    ],
    [
        "Daisy Moraa",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/733642326_122118081525026224_2885870464802509644_n.jpg",
        "daisy_moraa_seed_234"
    ],
    [
        "Rose Wanjiku",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/734128838_2453698855141766_4244516111376444952_n.jpg",
        "rose_wanjiku_seed_235"
    ],
    [
        "Anne Atieno",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/741112889_27430140549939906_3133747211808511004_n.jpg",
        "anne_atieno_seed_236"
    ],
    [
        "Queen Njeri",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/photo_3_2026-06-25_14-21-41.jpg",
        "queen_njeri_seed_237"
    ],
    [
        "Wanjiru Mwangi",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/photo_4_2026-06-25_14-21-41.jpg",
        "wanjiru_mwangi_seed_238"
    ],
    [
        "Tabitha Onyango",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/photo_5_2026-06-25_14-21-41.jpg",
        "tabitha_onyango_seed_239"
    ],
    [
        "Stella Chepkurui",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/photo_6_2026-06-25_14-21-41.jpg",
        "stella_chepkurui_seed_240"
    ],
    [
        "Phoebe Nekesa",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/photo_7_2026-06-24_14-00-45.jpg",
        "phoebe_nekesa_seed_241"
    ],
    [
        "Abby Wacera",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/photo_7_2026-06-25_14-21-41.jpg",
        "abby_wacera_seed_242"
    ],
    [
        "Brigid Chelagat",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/photo_8_2026-06-24_14-00-45.jpg",
        "brigid_chelagat_seed_243"
    ],
    [
        "Cindy Oduya",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/photo_8_2026-06-25_14-21-41.jpg",
        "cindy_oduya_seed_244"
    ],
    [
        "Deborah Cheptoo",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/photo_9_2026-06-25_14-21-41.jpg",
        "deborah_cheptoo_seed_245"
    ],
    [
        "Elsie Mukiri",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/photo_10_2026-06-25_14-21-41.jpg",
        "elsie_mukiri_seed_246"
    ],
    [
        "Fatuma Atieno",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/photo_11_2026-06-25_14-21-41.jpg",
        "fatuma_atieno_seed_247"
    ],
    [
        "Georgina Chepng'etich",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/photo_12_2026-06-25_14-21-41.jpg",
        "georgina_chepng_etich_seed_248"
    ],
    [
        "Hadija Moraa",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/photo_13_2026-06-25_14-21-41.jpg",
        "hadija_moraa_seed_249"
    ],
    [
        "Isabella Jeptoo",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/photo_14_2026-06-25_14-21-41.jpg",
        "isabella_jeptoo_seed_250"
    ],
    [
        "Jackline Wambui",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/photo_15_2026-06-25_14-21-41.jpg",
        "jackline_wambui_seed_251"
    ],
    [
        "Karen Nyaguthii",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/photo_16_2026-06-25_14-21-41.jpg",
        "karen_nyaguthii_seed_252"
    ],
    [
        "Laura Chepkoech",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/photo_17_2026-06-25_14-21-41.jpg",
        "laura_chepkoech_seed_253"
    ],
    [
        "Maureen Atieno",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/photo_18_2026-06-25_14-21-41.jpg",
        "maureen_atieno_seed_254"
    ],
    [
        "Niva Chepkirui",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/photo_19_2026-06-25_14-21-41.jpg",
        "niva_chepkirui_seed_255"
    ],
    [
        "Orina Kemunto",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/photo_20_2026-06-25_14-21-41.jpg",
        "orina_kemunto_seed_256"
    ],
    [
        "Patience Wanjala",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/photo_21_2026-06-24_14-00-45.jpg",
        "patience_wanjala_seed_257"
    ],
    [
        "Rita Cheptoo",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/photo_21_2026-06-25_14-21-41.jpg",
        "rita_cheptoo_seed_258"
    ],
    [
        "Sonia Adhiambo",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/photo_22_2026-06-25_14-21-41.jpg",
        "sonia_adhiambo_seed_259"
    ],
    [
        "Triza Mwende",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/photo_23_2026-06-25_14-21-41.jpg",
        "triza_mwende_seed_260"
    ],
    [
        "Una Cherono",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/photo_24_2026-06-25_14-21-41.jpg",
        "una_cherono_seed_261"
    ],
    [
        "Valarie Kemunto",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/photo_25_2026-06-24_14-00-45.jpg",
        "valarie_kemunto_seed_262"
    ],
    [
        "Whitney Achieng",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/photo_25_2026-06-25_14-21-41.jpg",
        "whitney_achieng_seed_263"
    ],
    [
        "Yvette Moraa",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/photo_26_2026-06-25_14-21-41.jpg",
        "yvette_moraa_seed_264"
    ],
    [
        "Zainabu Cherotich",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/photo_27_2026-06-25_14-21-42.jpg",
        "zainabu_cherotich_seed_265"
    ],
    [
        "Amina Wambui",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/photo_28_2026-06-25_14-21-42.jpg",
        "amina_wambui_seed_266"
    ],
    [
        "Beverly Jepkemoi",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/photo_29_2026-06-25_14-21-42.jpg",
        "beverly_jepkemoi_seed_267"
    ],
    [
        "Cherop Nyambura",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/photo_30_2026-06-25_14-21-42.jpg",
        "cherop_nyambura_seed_268"
    ],
    [
        "Delilah Otieno",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/photo_36_2026-06-25_14-21-42.jpg",
        "delilah_otieno_seed_269"
    ],
    [
        "Eunice Chemutai",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/photo_37_2026-06-25_14-21-42.jpg",
        "eunice_chemutai_seed_270"
    ],
    [
        "Fridah Kerubo",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/photo_38_2026-06-24_14-00-45.jpg",
        "fridah_kerubo_seed_271"
    ],
    [
        "Gina Jeptanui",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/photo_39_2026-06-25_14-21-42.jpg",
        "gina_jeptanui_seed_272"
    ],
    [
        "Hannah Chepchumba",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/photo_40_2026-06-25_14-21-42.jpg",
        "hannah_chepchumba_seed_273"
    ],
    [
        "Irene Moraa",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/photo_45_2026-06-25_14-21-42.jpg",
        "irene_moraa_seed_274"
    ],
    [
        "Joan Chepkwemoi",
        "mistress",
        "Sugar Daddy",
        29,
        "/seed/mistresses/photo_50_2026-06-25_14-21-42.jpg",
        "joan_chepkwemoi_seed_275"
    ],
    [
        "Kate Njuguna",
        "mistress",
        "Sugar Daddy",
        30,
        "/seed/mistresses/photo_60_2026-06-25_14-21-42.jpg",
        "kate_njuguna_seed_276"
    ],
    [
        "Lilian Chelagat",
        "mistress",
        "Sugar Daddy",
        31,
        "/seed/mistresses/photo_61_2026-06-24_14-00-45.jpg",
        "lilian_chelagat_seed_277"
    ],
    [
        "Marion Adhiambo",
        "mistress",
        "Sugar Daddy",
        32,
        "/seed/mistresses/photo_62_2026-06-25_14-21-42.jpg",
        "marion_adhiambo_seed_278"
    ],
    [
        "Nicole Chepkirui",
        "mistress",
        "Sugar Daddy",
        33,
        "/seed/mistresses/photo_65_2026-06-25_14-21-42.jpg",
        "nicole_chepkirui_seed_279"
    ],
    [
        "Olive Kemunto",
        "mistress",
        "Sugar Daddy",
        24,
        "/seed/mistresses/photo_75_2026-06-25_14-21-42.jpg",
        "olive_kemunto_seed_280"
    ],
    [
        "Peninah Jeptoo",
        "mistress",
        "Sugar Daddy",
        25,
        "/seed/mistresses/photo_81_2026-06-25_14-21-42.jpg",
        "peninah_jeptoo_seed_281"
    ],
    [
        "Queeneth Wanjiku",
        "mistress",
        "Sugar Daddy",
        26,
        "/seed/mistresses/photo_84_2026-06-25_14-21-42.jpg",
        "queeneth_wanjiku_seed_282"
    ],
    [
        "Rosemary Cherono",
        "mistress",
        "Sugar Daddy",
        27,
        "/seed/mistresses/photo_92_2026-06-25_14-21-42.jpg",
        "rosemary_cherono_seed_283"
    ],
    [
        "Sylvia Chepng'etich",
        "mistress",
        "Sugar Daddy",
        28,
        "/seed/mistresses/photo_99_2026-06-25_14-21-42.jpg",
        "sylvia_chepng_etich_seed_284"
    ],
    [
        "Brian Otieno",
        "toyboy",
        "Sugar Mummy",
        21,
        "/seed/Toboys%20or%20Sugarguys/33074199_100892130799522_3495405472528203776_n.jpg",
        "brian_otieno_seed_285"
    ],
    [
        "Kevin Mwangi",
        "toyboy",
        "Sugar Mummy",
        22,
        "/seed/Toboys%20or%20Sugarguys/185931923_1381394212230100_5558392581489931706_n.jpg",
        "kevin_mwangi_seed_286"
    ],
    [
        "Dennis Kariuki",
        "toyboy",
        "Sugar Mummy",
        23,
        "/seed/Toboys%20or%20Sugarguys/274264853_126423286569993_2264968628445958960_n.jpg",
        "dennis_kariuki_seed_287"
    ],
    [
        "Victor Onyango",
        "toyboy",
        "Sugar Mummy",
        24,
        "/seed/Toboys%20or%20Sugarguys/296171297_1702923866747390_3538781636036719562_n.jpg",
        "victor_onyango_seed_288"
    ],
    [
        "Samuel Kiptoo",
        "toyboy",
        "Sugar Mummy",
        25,
        "/seed/Toboys%20or%20Sugarguys/331223482_1213839255900917_8531574003822371435_n.jpg",
        "samuel_kiptoo_seed_289"
    ],
    [
        "Collins Mutua",
        "toyboy",
        "Sugar Mummy",
        26,
        "/seed/Toboys%20or%20Sugarguys/347231806_255059443836150_5409604150563389039_n.jpg",
        "collins_mutua_seed_290"
    ],
    [
        "Prince Wekesa",
        "toyboy",
        "Sugar Mummy",
        27,
        "/seed/Toboys%20or%20Sugarguys/421166389_10232798810295496_2971849676842817152_n.jpg",
        "prince_wekesa_seed_291"
    ],
    [
        "Elvis Kamau",
        "toyboy",
        "Sugar Mummy",
        28,
        "/seed/Toboys%20or%20Sugarguys/437719217_2646703395503025_6360511231710829247_n.jpg",
        "elvis_kamau_seed_292"
    ],
    [
        "Jayden Mboya",
        "toyboy",
        "Sugar Mummy",
        29,
        "/seed/Toboys%20or%20Sugarguys/441880359_3519774954835888_3468767879237667787_n.jpg",
        "jayden_mboya_seed_293"
    ],
    [
        "Kelvin Njoroge",
        "toyboy",
        "Sugar Mummy",
        30,
        "/seed/Toboys%20or%20Sugarguys/476833668_2397220923956857_2572344426947470110_n.jpg",
        "kelvin_njoroge_seed_294"
    ],
    [
        "Trevor Barasa",
        "toyboy",
        "Sugar Mummy",
        31,
        "/seed/Toboys%20or%20Sugarguys/500033566_1044994027562177_8952978723327278380_n.jpg",
        "trevor_barasa_seed_295"
    ],
    [
        "Ian Odhiambo",
        "toyboy",
        "Sugar Mummy",
        32,
        "/seed/Toboys%20or%20Sugarguys/600452318_122265705560087393_2361153885133218929_n.jpg",
        "ian_odhiambo_seed_296"
    ],
    [
        "Alex Kimani",
        "toyboy",
        "Sugar Mummy",
        33,
        "/seed/Toboys%20or%20Sugarguys/617599916_122202913052566004_79498922813243464_n.jpg",
        "alex_kimani_seed_297"
    ],
    [
        "Martin Ochieng",
        "toyboy",
        "Sugar Mummy",
        34,
        "/seed/Toboys%20or%20Sugarguys/625184544_1419625656467276_2358346507587707713_n.jpg",
        "martin_ochieng_seed_298"
    ],
    [
        "Felix Karanja",
        "toyboy",
        "Sugar Mummy",
        21,
        "/seed/Toboys%20or%20Sugarguys/657364635_4251222015141498_7551607690313937691_n.jpg",
        "felix_karanja_seed_299"
    ],
    [
        "Oscar Kiprono",
        "toyboy",
        "Sugar Mummy",
        22,
        "/seed/Toboys%20or%20Sugarguys/662861306_1607288647203567_8345731057531193628_n.jpg",
        "oscar_kiprono_seed_300"
    ],
    [
        "Ryan Mwangi",
        "toyboy",
        "Sugar Mummy",
        23,
        "/seed/Toboys%20or%20Sugarguys/670337372_1425630879317236_4402684486828648110_n.jpg",
        "ryan_mwangi_seed_301"
    ],
    [
        "Brandon Mutiso",
        "toyboy",
        "Sugar Mummy",
        24,
        "/seed/Toboys%20or%20Sugarguys/676568348_10241511833908363_5029788577271787669_n.jpg",
        "brandon_mutiso_seed_302"
    ],
    [
        "Lewis Omondi",
        "toyboy",
        "Sugar Mummy",
        25,
        "/seed/Toboys%20or%20Sugarguys/703752084_1582866733548829_1721878537780368033_n.jpg",
        "lewis_omondi_seed_303"
    ],
    [
        "Kingsley Pinzy",
        "toyboy",
        "Sugar Mummy",
        26,
        "/seed/Toboys%20or%20Sugarguys/724613947_10227124344292975_156736771374793158_n.jpg",
        "kingsley_pinzy_seed_304"
    ]
];

function slugify(value) {
    return String(value || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function labelText(label) {
    if (label === 'sugar_mummy') return 'Sugar Mummy';
    if (label === 'sugar_daddy') return 'Sugar Daddy';
    if (label === 'mistress') return 'Mistress';
    if (label === 'toyboy') return 'Sugar Guy / Toyboy';
    return 'Member';
}

export function localSeedRows() {
    return PROFILES.map(([name, label, lookingFor, age, photo, username], index) => {
        const [location, country] = LOCATIONS[index % LOCATIONS.length];
        const id = `seed-local-${String(index + 1).padStart(3, '0')}`;
        const seen = new Date(Date.now() - ((index % 8) + 1) * 18 * 60 * 1000).toISOString();
        const type = labelText(label);
        return {
            id,
            username: username || slugify(name),
            email: `seed+app-${String(index + 1).padStart(3, '0')}@genuinesugarmummies.co.ke`,
            display_name: name,
            avatar_url: photo,
            photos: [photo],
            bio: `${name} is a verified ${type} looking for ${lookingFor}. Values respect, privacy, and clear communication.`,
            description: `${name} is a verified ${type} looking for ${lookingFor}. Values respect, privacy, and clear communication.`,
            age,
            location,
            country,
            city: location,
            phone: '',
            phone_number: '',
            profile_label: label,
            member_category: label,
            looking_for: lookingFor,
            intent_summary: `I am a ${type} looking for ${lookingFor}.`,
            wants: label === 'sugar_mummy'
                ? 'A confident sugar guy or toyboy who is respectful, attentive, and serious.'
                : label === 'sugar_daddy'
                    ? 'A confident mistress who values respect, privacy, and clear communication.'
                    : label === 'mistress'
                        ? 'A mature sugar daddy who is respectful, generous, and serious.'
                        : 'A genuine sugar mummy who values respect, attention, and clear communication.',
            needed_qualities: 'respectful, honest, discreet, serious',
            age_range_preference: label === 'sugar_mummy' ? '21-34' : label === 'mistress' ? '45-68' : label === 'toyboy' ? '38-58' : '24-35',
            hobbies: ['travel', 'fine dining', 'private dates'],
            interests: ['verified members', 'respectful companionship', 'lifestyle support'],
            body_type: ['Elegant', 'Fit', 'Average', 'Curvy'][index % 4],
            subscription_tier: 'silver',
            verified: true,
            verification_status: 'verified',
            show_in_public: true,
            is_banned: false,
            is_suspended: false,
            total_profile_views: 900 + index * 83,
            followers_count: 35 + index * 4,
            gifts_received_count: 4 + (index % 40),
            admin_approved: true,
            package_locked: false,
            phone_reveal_plan: 'silver',
            is_seed_profile: true,
            boost_expires_at: null,
            boost_score: index % 6 === 0 ? 25 : 0,
            created_at: new Date(Date.now() - (index + 3) * 24 * 60 * 60 * 1000).toISOString(),
            last_seen_at: seen,
            last_seen: seen,
        };
    });
}

export function getLocalSeedMember(key) {
    const value = String(key || '').replace(/^@+/, '').toLowerCase();
    if (!value) return null;
    return localSeedRows().find((member) => member.id.toLowerCase() === value || member.username.toLowerCase() === value) || null;
}
