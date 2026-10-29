/**
 * Sample catalogue for demo mode. Identical to examples/products-input.csv and
 * public/templates/sample-products.csv (a test checks this). It deliberately has a
 * duplicate SKU, a missing name, an invalid price and a certification claim so the
 * validation and quality checks have something to show.
 */
export const SAMPLE_CSV = String.raw`SKU,Product Name,Brand,Category,Price,Currency,Specifications,Description,Features,Materials,Dimensions,Weight,Color,Size,UPC,Image URL,Keywords
LP-1001,Insulated Steel Water Bottle,Northpeak,Drinkware,24.99,USD,"Capacity: 750 ml; Insulation: double-wall vacuum; Keeps cold: up to 24 hours; Keeps hot: up to 12 hours; Lid: leak-proof screw cap","Stainless steel bottle for daily carry.","Fits most car cup holders | Powder-coated finish","18/8 stainless steel","26 x 7.5 cm",380 g,Forest Green,750 ml,012345678905,https://example.com/images/lp-1001.jpg,"water bottle, insulated bottle, reusable bottle"
LP-1002,Merino Crew Socks (3 Pack),Trailknit,Socks,29.00,USD,"Fiber blend: 70% merino wool, 27% nylon, 3% elastane; Cushioning: medium; Height: crew; Pack: 3 pairs","","Reinforced heel and toe | Flat toe seam","70% merino wool, 27% nylon, 3% elastane",,,Charcoal,M (US 7-9.5),,https://example.com/images/lp-1002.jpg,"merino socks, hiking socks"
LP-1003,Bamboo Cutting Board,Oakline Home,Kitchen,34.50,USD,"Material: bamboo; Juice groove: yes; Handles: two side handles; Care: hand wash only","Large cutting board for prep work.","",bamboo,"45 x 30 x 2 cm",1.6 kg,Natural,Large,,,"cutting board, chopping board"
LP-1004,Wireless Earbuds Pro,Sonora,Audio,79.99,USD,"Bluetooth: 5.3; Battery (earbuds): 7 hours; Battery (with case): 28 hours; Charging: USB-C; Noise cancellation: active (ANC); Microphones: 4","","Touch controls | Transparency mode","",,52 g (with case),Black,,0850001234563,https://example.com/images/lp-1004.jpg,"wireless earbuds, noise cancelling earbuds"
LP-1005,Organic Cotton Tote Bag,Fieldday,Bags,18.00,EUR,"Material: GOTS certified organic cotton (certificate no. 12-345); Handle drop: 28 cm; Internal pocket: 1","Everyday tote bag.","","100% organic cotton","38 x 42 cm",,Natural,One size,,,"tote bag, cotton bag, shopping bag"
LP-1006,Ceramic Pour-Over Coffee Dripper,Kettle & Co,Coffee,22.00,USD,"Material: porcelain; Fits: size 02 cone filters; Brews: 1-4 cups","","Three drainage holes","porcelain",12 x 14 cm,340 g,White,02,,,"pour over, coffee dripper"
LP-1007,LED Desk Lamp,Lumora,Lighting,"49,90",EUR,"Brightness: 5 levels; Color temperature: 2700K-6500K; Power: 10 W; USB-A charging port: yes","A slim lamp for desks.","Touch dimmer | Memory function","aluminium",,,Silver,,,,"desk lamp, led lamp"
LP-1001,Insulated Steel Water Bottle,Northpeak,Drinkware,24.99,USD,"Capacity: 750 ml","Duplicate row exported twice by mistake.","","",,,Forest Green,750 ml,,,
LP-1008,,Northpeak,Drinkware,19.99,USD,"Capacity: 500 ml","Row with no product name.","","",,,Slate,500 ml,,,
LP-1009,Yoga Mat,Asana Lab,Fitness,abc,USD,"Thickness: 6 mm; Length: 183 cm; Width: 61 cm","","Textured surface","TPE",,,Lilac,,,,"yoga mat, exercise mat"
LP-1010,Kids Rain Jacket,Puddlejump,Kidswear,39.95,GBP,"Shell: 100% polyester with PU coating; Seams: taped; Hood: detachable; Reflective trims: yes","","Elasticated cuffs","100% polyester",,,Yellow,Age 4-5,,https://example.com/images/lp-1010.jpg,"kids rain jacket, toddler raincoat"
`;
