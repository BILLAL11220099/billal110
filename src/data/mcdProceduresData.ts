/**
 * McDonald's Restaurant Daily Operations standard data specifications.
 * All steps adhere strictly to HACCP, safety, and operation manuals.
 */

export interface ProceduralStep {
  stepNumber: number;
  id: string;
  title: string;
  description: string;
  purpose: string;
  importantNotes: string;
  commonMistakes: string;
  category: "Opening" | "Closing";
}

export const OPENING_STEPS: ProceduralStep[] = [
  {
    stepNumber: 1,
    id: "open_1",
    category: "Opening",
    title: "Restaurant Exterior Inspection",
    description: "Walk around the outer perimeter of the restaurant. Check for general debris, ensure the drive-thru lane is entirely free of obstructions, verify landscaping is tidy, and investigate any exterior damage or structural safety issues.",
    purpose: "Establishes a pristine, clean first impression for early guests and ensures a safe, accessible pathway for both drive-thru and pedestrian traffic.",
    importantNotes: "Pay special attention to the trash enclosure area; ensure heavy dumpsters are secure and gates are locked if necessary. Check that external menu boards are clean and lit.",
    commonMistakes: "Skipping the perimeter inspection on cold or rainy mornings, which leads to trash or hazards remaining in drive-thru lanes."
  },
  {
    stepNumber: 2,
    id: "open_2",
    category: "Opening",
    title: "Store Unlocking Procedure",
    description: "Enter the premises following double-custody safety standards if applicable. Disarm the security system within the allotted time window, lock the entrance door immediately behind you, and log your arrival time.",
    purpose: "Maintains optimal personal security during high-risk dark early hours and prevents unauthorized entry while setting up.",
    importantNotes: "Always verify that no strangers are loitering near the door before entering. If you notice signs of forced entry, do not go inside; contact local emergency lines immediately from a safe spot.",
    commonMistakes: "Leaving the main doors unlocked while preparing the interior workspace, allowing strangers to enter the building unchecked."
  },
  {
    stepNumber: 3,
    id: "open_3",
    category: "Opening",
    title: "Security and Safety Checks",
    description: "Do a quick, focused walk-through of all areas: back-of-house (BOH), restrooms, cold rooms, and lobby. Ensure emergency exits are unblocked and panic buttons are accessible.",
    purpose: "Guarantees that the restaurant is physically safe for the crew before active operations commence.",
    importantNotes: "Verify that fire extinguishers possess a full charge and that the first aid kit remains fully stocked with modern safety supplies.",
    commonMistakes: "Failing to check that fire exit doors are fully cleared, which could block emergency egress."
  },
  {
    stepNumber: 4,
    id: "open_4",
    category: "Opening",
    title: "Lights and Equipment Startup",
    description: "Turn on the primary BOH and FOH lighting banks. Sequentially activate key electrical panel breakers and terminal breakers following the staggered sequence rule.",
    purpose: "Saves energy on low-activity hours and prevents dangerous electrical power surges that can trip primary circuit breakers.",
    importantNotes: "Follow the printed checklist order. Stagger power switches by 10-15 seconds to avoid sudden electrical spikes.",
    commonMistakes: "Powering up all high-draw heating and motor units simultaneously, leading to tripped fuses or equipment damage."
  },
  {
    stepNumber: 5,
    id: "open_5",
    category: "Opening",
    title: "POS System Startup",
    description: "Power on all front counter point-of-sale registers, drive-thru cashier terminals, and self-service kiosks. Verify that thermal printer paper rolls are sufficiently loaded and terminals boot to the live sales screen.",
    purpose: "Preparedness for immediate order taking and prevents lane bottlenecks when the first customer arrives.",
    importantNotes: "Verify network status indicators are solid green. Test a mock order if the cash register reports connectivity issues.",
    commonMistakes: "Failing to check if kiosks are booted on time, resulting in early morning lobby guests queuing at a single manual lane."
  },
  {
    stepNumber: 6,
    id: "open_6",
    category: "Opening",
    title: "Kitchen Equipment Startup",
    description: "Activate main holding drawers, bun toasters, prep-table warming loops, and hot holding cabinets. Set temperature dials to the specified breakfast mode and allow units to reach operational warmth.",
    purpose: "Ensures that bun toasting and sandwich holding systems meet strict target quality temperatures from the start.",
    importantNotes: "Verify that holding pans are thoroughly dry before inserting them into heated drawers to prevent steam burn hazards.",
    commonMistakes: "Placing wet or damp holding trays into high-temperature cabinets, leading to water accumulation and food safety failures."
  },
  {
    stepNumber: 7,
    id: "open_7",
    category: "Opening",
    title: "Fry Station Setup",
    description: "Activate the fryers (Vats startup) and salt/scoop workstation. Set correct preheat parameters for Hashbrowns and Fries. Check that oil filter valves are closed before powering heaters.",
    purpose: "Brings frying oil to cooking temperatures safely while prepping the assembly line for early morning hashbrown sales.",
    importantNotes: "Ensure that fry baskets are thoroughly sanitized and that the salting shaker is loaded with standard McDonald's shaker salt.",
    commonMistakes: "Turning on fryers when the oil is below the minimum level line, which triggers temperature alarms or creates severe fire risks."
  },
  {
    stepNumber: 8,
    id: "open_8",
    category: "Opening",
    title: "Grill Setup",
    description: "Power up the clamshell grills. Initiate the automated self-calibration routine. Select 'Breakfast Sausage' profiles and inspect the condition of non-stick Teflon sheets.",
    purpose: "Prepares grill surfaces for rapid, high-temperature sausage and folded/round egg breakfast production under standard pressure parameters.",
    importantNotes: "Check the grease collectors; ensure they are empty, cleaned, and properly aligned before cooking.",
    commonMistakes: "Skipping Teflon sheet alignment checks, causing torn or loose sheets that stick to and burn food patties."
  },
  {
    stepNumber: 9,
    id: "open_9",
    category: "Opening",
    title: "Beverage Station Setup",
    description: "Attach clean, sanitized nozzles to dispenser taps. Turn on carbon dioxide (CO2) valves and verify syrup lines (BIBs) are online and pressurized. Perform a small sample pour.",
    purpose: "Guarantees fresh, bubbly sodas and prevents flat or syrup-less dispenser outputs for the first customers.",
    importantNotes: "Always wash your hands thoroughly before handling the beverage nozzles.",
    commonMistakes: "Reusing beverage nozzles from the previous day without subverting them to overnight sanitization."
  },
  {
    stepNumber: 10,
    id: "open_10",
    category: "Opening",
    title: "Coffee Machine Preparation",
    description: "Execute the startup rinse cycle on the McCafé espresso and drip coffee machines. Fill hopper reservoirs with fresh McCafé espresso beans, load drip filters, and check decanters.",
    purpose: "Guarantees elite taste quality and temperature for coffee, which represents the highest-volume breakfast item.",
    importantNotes: "Verify that the milk container is loaded with fresh, chilled dairy and that internal temperature sits safely under 40°F (4°C).",
    commonMistakes: "Skipping the automated espresso rinse cycle, leaving stale coffee residue and affecting first pour taste."
  },
  {
    stepNumber: 11,
    id: "open_11",
    category: "Opening",
    title: "Ice Machine Check",
    description: "Slide open the primary ice dispenser reservoirs. Inspect the scoop and sanitize its custom storage cradle. Verify there is zero debris in the ice hold and scoop is housed correctly.",
    purpose: "Maintains absolute hygiene standards, preventing dangerous pathogen development in the ice supply.",
    importantNotes: "The ice scoop must always reside in the holder. Never leave the scoop sitting in the actual ice compartment.",
    commonMistakes: "Leaving the ice scoop resting inside the ice hopper, which violates basic food safety cross-contamination policies."
  },
  {
    stepNumber: 12,
    id: "open_12",
    category: "Opening",
    title: "Stock and Inventory Verification",
    description: "Retrieve necessary breakfast buns, wrapped egg cartons, butter pats, sausage cases, hashbrown sleeves, and cup lines from BOH cold rooms. Load prep-table dispensers utilizing FIFO.",
    purpose: "Maintains rapid kitchen assembly and prevents delays associated with running to BOH during peaks.",
    importantNotes: "Always rotate products using FIFO (First In, First Out) rules. Use older expiration boxes first.",
    commonMistakes: "Loading fresh stock products in front of existing lines, resulting in waste and outdated expiration periods."
  },
  {
    stepNumber: 13,
    id: "open_13",
    category: "Opening",
    title: "Food Safety Temperature Checks",
    description: "Calibrate the digital thermal temperature probe in a 50/50 crushed ice water mix until it registers 32°F (0°C). Log initial air temperatures in the walk-in cooler, walk-in freezer, and prep cases.",
    purpose: "Verifies the cold chain is integer and ensures that refrigeration is within critical HACCP control thresholds.",
    importantNotes: "Refrigerators should sit at 33°F-40°F (0.5°C-4°C). Freezers should be 0°F or lower (-18°C). Log any discrepancy immediately.",
    commonMistakes: "Faking temperature values on sheets without physically dipping the probe or checking the digital screens."
  },
  {
    stepNumber: 14,
    id: "open_14",
    category: "Opening",
    title: "Cash Register Preparation",
    description: "Retrieve commencing shift money drawers (tills) from the main manager safe. Verify the starting drawer count (e.g., $150 or standard base), insert drawers into register slots, and lock the register doors.",
    purpose: "Secures cash systems and validates perfect balance before sales, protecting cashier accountability.",
    importantNotes: "Always count under the secure manager overhead camera to ensure transparency. Never hand drift drawers blindly.",
    commonMistakes: "Failing to physically recount loose cash bills in the startup drawer, leading to cash variance discrepancies later."
  },
  {
    stepNumber: 15,
    id: "open_15",
    category: "Opening",
    title: "Dining Area Preparation",
    description: "Inspect the customer seating space. Wipe tables down with fresh sanitizing solution towels. Align chairs, sweep paths, empty entryway bins, and verify restrooms are clean and locked/ready.",
    purpose: "Prepares an inviting, clean, and pleasant atmosphere that welcomes family and business guests.",
    importantNotes: "Set up 'Caution: Wet Floor' sign boards if mop washing is in progress. Verify entry door handles are clear and dry.",
    commonMistakes: "Leaving dirty tables or sticky spots in high-traffic sections from late-night traffic, hurting early morning impressions."
  },
  {
    stepNumber: 16,
    id: "open_16",
    category: "Opening",
    title: "Drive-Thru Preparation",
    description: "Turn on drive-thru headset systems. Insert fresh batteries and sync units to the main receiver. Check that the speaker box intercom is crisp, and test the customer payment pin pads.",
    purpose: "Ensures seamless order communication and speedy transaction workflow at the window.",
    importantNotes: "Prepare window condiments (napkins, bags, sauce straws) in organized storage, within comfortable reach.",
    commonMistakes: "Failing to test headset intercoms prior to peak drive-thru launch, resulting in immediate order intake failures."
  },
  {
    stepNumber: 17,
    id: "open_17",
    category: "Opening",
    title: "Delivery System Check",
    description: "Power on delivery tablets (UberEats, DoorDash, etc.). Verify internet connection is stable and that systems report 'Active / Open'. Mount order receipt printers.",
    purpose: "Enables instant capture of lucrative mobile and remote delivery orders and guarantees speedy courier hand-offs.",
    importantNotes: "Synchronize delivery bag seals (labels and tape) near the assembly area or packing counter.",
    commonMistakes: "Forgetting to sign in to delivery portals, leading to immediate order delays or cancellation flags."
  },
  {
    stepNumber: 18,
    id: "open_18",
    category: "Opening",
    title: "Final Readiness Verification",
    description: "Execute a 5-minute morning crew huddle. Review daily speed-of-service targets (e.g., drive-thru time under 120 seconds), allocate tasks, check uniform compliance, and wash hands.",
    purpose: "Inspires crew alignment, emphasizes core goals, reinforces food safety, and aligns shifts for peak outcomes.",
    importantNotes: "Review safety guidelines and double check that everyone is wearing clean uniforms and approved hairnets/caps.",
    commonMistakes: "Skipping the morning coordination huddle when under-staffed, leading to disorganized roles and chaotic kitchen flow."
  }
];

export const CLOSING_STEPS: ProceduralStep[] = [
  {
    stepNumber: 1,
    id: "close_1",
    category: "Closing",
    title: "Last Order Procedures",
    description: "Monitor order flow as the closing time approaches. Respectfully announce building closing hours to any remaining lobby guests. Verify all late-night orders are finished.",
    purpose: "Facilitates a graceful, organized threshold transition from active service to deep cleanup cycles.",
    importantNotes: "Do not switch off primary grills or fryers prematurely. Keep cooking active until the exact scheduled closing second.",
    commonMistakes: "Turning off systems 15 minutes early, forcing cancellation of late-night sales and disappointing guests."
  },
  {
    stepNumber: 2,
    id: "close_2",
    category: "Closing",
    title: "Food Waste Recording",
    description: "Gather and compile all outdated, expired, or unused raw and preparation line products. Input waste logs (e.g., counts of beef patties, breakfast pies, salads) into the manager app.",
    purpose: "Accurately calculates daily cost of sales, manages margin leakage, and adjusts tomorrow's prep numbers.",
    importantNotes: "Separate waste categories clearly. Make sure no trash is mixed into the clean waste counts for inspection.",
    commonMistakes: "Throwing old items directly into garbage dumpsters without scanning, which corrupts inventory reconciliation."
  },
  {
    stepNumber: 3,
    id: "close_3",
    category: "Closing",
    title: "Product Storage Procedures",
    description: "Transfer remaining cheese slices, sauce tubes, and raw meats into clean holding containers. Mark items with approved secondary shelf-life 'Day Dots' and store them in BOH refrigerators.",
    purpose: "Prevents bacteria breeding and keeps ingredients fresh, conforming to strict shelf-life standards.",
    importantNotes: "Ensure all refrigerated storage trays are covered or sealed and and placed at the correct height off the floor.",
    commonMistakes: "Leaving perishable condiments or raw items on warm prep lines overnight, forcing massive waste in the morning."
  },
  {
    stepNumber: 4,
    id: "close_4",
    category: "Closing",
    title: "Equipment Shutdown Sequence",
    description: "Safely unplug and turn off holding drawers, bun toasters, vertical cabinets, and prep heaters. Let units cool down according to safe standards.",
    purpose: "Prevents high-heat equipment from running empty overnight, eliminating major fire hazards and reducing utility load.",
    importantNotes: "Verify that primary walk-in cold storage power is NOT touched. Only shut kitchen assembly units.",
    commonMistakes: "Accidentally shutting off main walk-in chiller breaker switches, leading to total ingredient spoilage."
  },
  {
    stepNumber: 5,
    id: "close_5",
    category: "Closing",
    title: "Grill Cleaning",
    description: "Apply approved high-temperature grill cleaning solution onto flat tops. Scrape caramelized grease into traps. Wipe down hood filters and polish side walls.",
    purpose: "Maintains optimal heat transfer for cooking and prevents dangerous grease accumulations in vents.",
    importantNotes: "Always wear heat-resistant insulated arm sleeves, safety eye goggles, and heavy-duty protective gloves.",
    commonMistakes: "Skipping protective gear and using cold metal blades, leading to severe chemical burns or scratched plates."
  },
  {
    stepNumber: 6,
    id: "close_6",
    category: "Closing",
    title: "Fry Station Cleaning",
    description: "Scrape down the deep fry workstation, pull grease pans, and cycle the automated oil filtering/pumping loops. Polish exterior steel trim and place element covers.",
    purpose: "Maintains clear, clean frying oil life, stops grease smoke, and secures fryers from dust or debris.",
    importantNotes: "Let the oil cool slightly before opening valves. Never introduce water into heaters loaded with hot oil.",
    commonMistakes: "Squirting or splashing sanitizing water near hot oil vats, which triggers violent steam eruptions and serious injuries."
  },
  {
    stepNumber: 7,
    id: "close_7",
    category: "Closing",
    title: "Beverage Station Cleaning",
    description: "Remove dispenser nozzles from counter and drive-thru soda lines. Soak nozzles in approved warm sanitizer wash overnight. Wipe down the sticky syrup splash zones.",
    purpose: "Stops mold, fruit fly nesting, and yeast bacteria development inside sweet beverage delivery pathways.",
    importantNotes: "Avoid soaking nozzles in carbonated soda water; always utilize hot sanitizing solution to dissolve sugary syrup.",
    commonMistakes: "Soaking soda nozzles in ambient club soda instead of fresh sanitizer, which feeds bacteria instead of killing it."
  },
  {
    stepNumber: 8,
    id: "close_8",
    category: "Closing",
    title: "Dining Area Cleaning",
    description: "Sanitize and wash all lobby counter tops, tables, and partitions. Sweep and mop tile floors using approved kitchen detergent. Rearrange and align chairs.",
    purpose: "Ensures the main dining lobby is sterile, dry, and clean for early morning breakfast guests.",
    importantNotes: "Utilize distinct, separate color-coded mops for the front-of-house (usually red-collared or blue-collared mops).",
    commonMistakes: "Using the kitchen grease-moisture mops in the guest seating lobby, causing slick floors and black dirt smudges."
  },
  {
    stepNumber: 9,
    id: "close_9",
    category: "Closing",
    title: "Restroom Cleaning",
    description: "Clean restroom commodes, urinal bays, and washbasins. Wipe down high-touch door handles and mirror glasses. Verify soap and paper towels are packed.",
    purpose: "Maintains guest hygiene standards and eliminates foul-smelling odors.",
    importantNotes: "Restroom cleanup must utilize yellow-colored mops and sanitizers ONLY, never mix restroom gear with kitchen assets.",
    commonMistakes: "Cleaning toilets with the same rags or mops used on dining tables, showing severe cross-contamination."
  },
  {
    stepNumber: 10,
    id: "close_10",
    category: "Closing",
    title: "Trash Removal",
    description: "Tie up and bag garbage from lobby and kitchen bins. Transport bags to the external dumpster corral. Sweep the container gate pad.",
    purpose: "Prevents flies, rodent attraction, and bad smells in the restaurant overnight.",
    importantNotes: "Always take trash outside in pairs of at least two crew members after dark. Never prop the back door open.",
    commonMistakes: "Leaving trash bags sitting inside the kitchen over night, creating strong smells and attracting unwanted pests."
  },
  {
    stepNumber: 11,
    id: "close_11",
    category: "Closing",
    title: "Inventory Count",
    description: "Conduct physical counts of critical high-theft or high-waste items like buns, beef cases, cheese stacks, and french fry sacks. Log values in the manager sheets.",
    purpose: "Identifies early operational discrepancies and keeps actual food costs locked into the store database.",
    importantNotes: "Measure in complete case units or sleeves. Avoid guessing or estimating box weights.",
    commonMistakes: "Penciling inside estimates in place of actual counts, hiding stock shrinkage issues from management."
  },
  {
    stepNumber: 12,
    id: "close_12",
    category: "Closing",
    title: "Cash Reconciliation",
    description: "Collect and count cashier till drawers in the safe office. Reconcile cash, card sales, and delivery slips. Deposit standard drops and pull the final system Z-Report.",
    purpose: "Secures actual corporate revenue, detects cashier register fraud, and closes cash transactions for the day.",
    importantNotes: "Only count money when safe room door is thoroughly locked. Keep safe dial closed during active count.",
    commonMistakes: "Counting money in open lanes or public view, which constitutes a severe security exposure to robberies."
  },
  {
    stepNumber: 13,
    id: "close_13",
    category: "Closing",
    title: "Security Checks",
    description: "Walk the perimeter, lobby, and storage areas. Check drive-thru transaction windows are bolted, back doors locked, and check that no children are in the PlayPlace.",
    purpose: "Prevents break-ins, ensures no guests are trapped, and secures retail locks.",
    importantNotes: "Inspect restrooms and BOH utility areas to ensure all faucets and water outlets are fully off.",
    commonMistakes: "Leaving a drive-thru slide window unlocked, allowing simple break-ins during silent overnight hours."
  },
  {
    stepNumber: 14,
    id: "close_14",
    category: "Closing",
    title: "Lock-up Procedures",
    description: "Activate the burglar security alarm system. Exit through the final exit door as a coordinated team. Lock the exterior main door, testing the handle physically.",
    purpose: "Ensures the building is fully secure and that the closing staff remains safe as they leave together.",
    importantNotes: "Never exit alone; walk to vehicles in pairs for safety. Verify the alarm keypad shows armed red before closure.",
    commonMistakes: "Locking up individually and leaving crew members alone in pitch-dark exterior areas without support."
  }
];
