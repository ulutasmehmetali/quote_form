export type ServiceType =
  | 'Air Conditioning'
  | 'Carpentry'
  | 'Cleaning'
  | 'Concrete'
  | 'Drywall'
  | 'Electrician'
  | 'Fencing'
  | 'Flooring'
  | 'Garage Door Installation'
  | 'Garage Door Repair'
  | 'Handyman'
  | 'Heating & Furnace'
  | 'HVAC Contractors'
  | 'Landscaping'
  | 'Painting'
  | 'Pest Control'
  | 'Plumbing'
  | 'Remodeling'
  | 'Roofing'
  | 'Tile';

export type QuestionAnswer = string | string[] | null;

export interface UploadedPhoto {
  url: string;
  key: string;
  provider: string;
}

export interface QuoteFormData {
  serviceType: ServiceType | '';
  zipCode: string;
  responses: Record<string, QuestionAnswer>;
  uploadedPhotos?: UploadedPhoto[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface QuestionConfig {
  id: string;
  question: string;
  type: 'choice' | 'text' | 'date' | 'multiselect';
  options?: string[];
  required?: boolean;
}

export const SERVICE_QUESTIONS: Record<ServiceType, QuestionConfig[]> = {
  'Carpentry': [
    { id: 'project_type', question: 'What type of carpentry work do you need?', type: 'choice', options: ['Cabinet Installation', 'Custom Furniture', 'Deck Building', 'Door Installation', 'Framing', 'Trim & Molding', 'Other'], required: true },
    { id: 'project_scope', question: 'What is the scope of your project?', type: 'choice', options: ['Small (1-2 days)', 'Medium (3-7 days)', 'Large (1-2 weeks)', 'Major (2+ weeks)'], required: true },
    { id: 'timeline', question: 'When would you like to start?', type: 'choice', options: ['As soon as possible', 'Within 1 week', 'Within 1 month'], required: true },
    { id: 'additional_details', question: 'Please provide any additional details', type: 'text', required: false }
  ],
  'Plumbing': [
    { id: 'service_type', question: 'What type of plumbing service do you need?', type: 'choice', options: ['Emergency Repair', 'Leak Repair', 'Drain Cleaning', 'Fixture Installation', 'Water Heater', 'Pipe Replacement', 'Bathroom Remodel', 'Other'], required: true },
    { id: 'urgency', question: 'How urgent is this issue?', type: 'choice', options: ['Emergency (24 hours)', 'Urgent (2-3 days)', 'Normal (Within a week)', 'As soon as possible'], required: true },
    { id: 'property_type', question: 'What type of property?', type: 'choice', options: ['Residential - Single Family', 'Residential - Multi-Unit', 'Commercial', 'Industrial'], required: true },
    { id: 'additional_details', question: 'Describe the issue or project', type: 'text', required: true }
  ],
  'Landscaping': [
    { id: 'service_needed', question: 'What landscaping services do you need?', type: 'multiselect', options: ['Lawn Maintenance', 'Tree Trimming/Removal', 'Garden Design', 'Irrigation System', 'Hardscaping', 'Seasonal Cleanup', 'Sod Installation'], required: true },
    { id: 'property_size', question: 'What is the size of your property?', type: 'choice', options: ['Small (Under 5,000 sq ft)', 'Medium (5,000-10,000 sq ft)', 'Large (10,000-20,000 sq ft)', 'Very Large (20,000+ sq ft)'], required: true },
    { id: 'frequency', question: 'How often do you need service?', type: 'choice', options: ['One-time project', 'Weekly', 'Bi-weekly', 'Monthly', 'Seasonal'], required: true },
    { id: 'additional_details', question: 'Any specific requirements or preferences?', type: 'text', required: false }
  ],
  'Roofing': [
    { id: 'service_type', question: 'What roofing service do you need?', type: 'choice', options: ['Roof Repair', 'New Roof Installation', 'Roof Replacement', 'Roof Inspection', 'Emergency Leak Repair', 'Gutter Work'], required: true },
    { id: 'roof_type', question: 'What type of roof do you have?', type: 'choice', options: ['Asphalt Shingles', 'Metal', 'Tile', 'Flat Roof', 'Not Sure'], required: true },
    { id: 'urgency', question: 'When do you need this done?', type: 'choice', options: ['Emergency - Active Leak', 'Within 1 week', 'Within 1 month', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Describe the issue or project', type: 'text', required: true }
  ],
  'Remodeling': [
    { id: 'room_type', question: 'Which room(s) are you remodeling?', type: 'multiselect', options: ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Basement', 'Whole House', 'Other'], required: true },
    { id: 'project_scope', question: 'What is the scope of your remodel?', type: 'choice', options: ['Cosmetic updates', 'Moderate renovation', 'Complete gut and rebuild', 'Addition/Expansion'], required: true },
    { id: 'budget_range', question: 'What is your approximate budget?', type: 'choice', options: ['Under $10,000', '$10,000 - $25,000', '$25,000 - $50,000', '$50,000 - $100,000', 'Over $100,000'], required: true },
    { id: 'timeline', question: 'When would you like to start?', type: 'choice', options: ['Within 1 month', '1-3 months', '3-6 months', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Tell us about your vision', type: 'text', required: false }
  ],
  'HVAC Contractors': [
    { id: 'service_type', question: 'What HVAC service do you need?', type: 'choice', options: ['New Installation', 'Repair', 'Maintenance', 'Replacement', 'Emergency Service', 'Inspection'], required: true },
    { id: 'system_type', question: 'What type of system?', type: 'choice', options: ['Central AC', 'Heat Pump', 'Furnace', 'Ductless Mini-Split', 'Boiler', 'Not Sure'], required: true },
    { id: 'property_size', question: 'Approximate property size?', type: 'choice', options: ['Under 1,000 sq ft', '1,000-2,000 sq ft', '2,000-3,000 sq ft', 'Over 3,000 sq ft'], required: true },
    { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['Emergency - No heating/cooling', 'Within 2-3 days', 'Within a week', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Additional information', type: 'text', required: false }
  ],
  'Electrician': [
    { id: 'service_type', question: 'What electrical service do you need?', type: 'choice', options: ['Electrical Repair', 'New Installation', 'Panel Upgrade', 'Lighting Installation', 'Outlet/Switch Work', 'Emergency Service', 'Inspection'], required: true },
    { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['Emergency - Safety Concern', 'Within 24 hours', 'Within 1 week', 'As soon as possible'], required: true },
    { id: 'property_type', question: 'Property type?', type: 'choice', options: ['Residential', 'Commercial', 'Industrial'], required: true },
    { id: 'additional_details', question: 'Describe the work needed', type: 'text', required: true }
  ],
  'Painting': [
    { id: 'project_type', question: 'What needs to be painted?', type: 'multiselect', options: ['Interior Walls', 'Exterior Walls', 'Ceiling', 'Trim/Doors', 'Cabinets', 'Deck/Fence', 'Commercial Space'], required: true },
    { id: 'project_size', question: 'How many rooms or what square footage?', type: 'choice', options: ['1-2 rooms', '3-4 rooms', '5+ rooms', 'Whole house', 'Exterior only'], required: true },
    { id: 'condition', question: 'What is the current condition?', type: 'choice', options: ['Good - just needs paint', 'Some prep work needed', 'Significant prep (repairs, priming)', 'New construction'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 1 week', 'Within 1 month', '1-3 months', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Any color preferences or special requirements?', type: 'text', required: false }
  ],
  'Flooring': [
    { id: 'flooring_type', question: 'What type of flooring are you interested in?', type: 'choice', options: ['Hardwood', 'Laminate', 'Tile', 'Carpet', 'Vinyl/LVP', 'Concrete', 'Not Sure Yet'], required: true },
    { id: 'project_type', question: 'What type of project?', type: 'choice', options: ['New Installation', 'Replacement', 'Repair', 'Refinishing'], required: true },
    { id: 'area_size', question: 'Approximate square footage?', type: 'choice', options: ['Under 500 sq ft', '500-1,000 sq ft', '1,000-2,000 sq ft', 'Over 2,000 sq ft'], required: true },
    { id: 'rooms', question: 'Which rooms?', type: 'multiselect', options: ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Hallway', 'Basement', 'Whole House'], required: true },
    { id: 'timeline', question: 'When would you like to start?', type: 'choice', options: ['Within 2 weeks', 'Within 1 month', '1-3 months', 'As soon as possible'], required: true }
  ],
  'Air Conditioning': [
    { id: 'service_type', question: 'What AC service do you need?', type: 'choice', options: ['New Installation', 'Repair', 'Maintenance', 'Replacement', 'Emergency Service'], required: true },
    { id: 'system_type', question: 'What type of AC system?', type: 'choice', options: ['Central Air', 'Ductless Mini-Split', 'Window Unit', 'Portable Unit', 'Not Sure'], required: true },
    { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['Emergency - No cooling', 'Within 24-48 hours', 'Within a week', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Additional information', type: 'text', required: false }
  ],
  'Cleaning': [
    { id: 'cleaning_type', question: 'What type of cleaning service?', type: 'choice', options: ['Regular House Cleaning', 'Deep Cleaning', 'Move In/Out Cleaning', 'Post-Construction', 'Commercial Cleaning', 'Carpet Cleaning'], required: true },
    { id: 'frequency', question: 'How often do you need service?', type: 'choice', options: ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Occasional'], required: true },
    { id: 'property_size', question: 'Property size?', type: 'choice', options: ['Small (Under 1,000 sq ft)', 'Medium (1,000-2,000 sq ft)', 'Large (2,000-3,000 sq ft)', 'Very Large (3,000+ sq ft)'], required: true },
    { id: 'bedrooms_bathrooms', question: 'Number of bedrooms and bathrooms?', type: 'text', required: true }
  ],
  'Concrete': [
    { id: 'project_type', question: 'What concrete work do you need?', type: 'choice', options: ['Driveway', 'Patio', 'Sidewalk', 'Foundation', 'Slab', 'Steps', 'Repair/Resurfacing', 'Other'], required: true },
    { id: 'project_scope', question: 'Is this new installation or repair?', type: 'choice', options: ['New Installation', 'Repair', 'Replacement', 'Resurfacing'], required: true },
    { id: 'area_size', question: 'Approximate area (square feet)?', type: 'choice', options: ['Under 200 sq ft', '200-500 sq ft', '500-1,000 sq ft', 'Over 1,000 sq ft'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 2 weeks', 'Within 1 month', '1-3 months', 'As soon as possible'], required: true }
  ],
  'Drywall': [
    { id: 'service_type', question: 'What drywall service do you need?', type: 'choice', options: ['New Installation', 'Repair', 'Texturing', 'Water Damage Repair', 'Ceiling Work', 'Other'], required: true },
    { id: 'project_size', question: 'Size of the project?', type: 'choice', options: ['Small patch (under 2 sq ft)', 'Medium repair (2-10 sq ft)', 'Large area (10-50 sq ft)', 'Full room or more'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 1 week', 'Within 2 weeks', 'Within 1 month', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Describe the work needed', type: 'text', required: false }
  ],
  'Fencing': [
    { id: 'fence_type', question: 'What type of fence?', type: 'choice', options: ['Wood', 'Vinyl', 'Chain Link', 'Aluminum', 'Iron', 'Composite', 'Not Sure'], required: true },
    { id: 'project_type', question: 'What type of project?', type: 'choice', options: ['New Installation', 'Repair', 'Replacement', 'Gate Installation'], required: true },
    { id: 'linear_feet', question: 'Approximate length needed?', type: 'choice', options: ['Under 50 ft', '50-100 ft', '100-200 ft', 'Over 200 ft'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 2 weeks', 'Within 1 month', '1-3 months', 'As soon as possible'], required: true }
  ],
  'Garage Door Installation': [
    { id: 'door_type', question: 'What type of garage door?', type: 'choice', options: ['Single Door', 'Double Door', 'Custom Size', 'Not Sure'], required: true },
    { id: 'material', question: 'Preferred material?', type: 'choice', options: ['Steel', 'Wood', 'Aluminum', 'Fiberglass', 'Not Sure'], required: true },
    { id: 'opener_needed', question: 'Do you need an opener installed?', type: 'choice', options: ['Yes, new opener', 'No, door only', 'Replace existing opener'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 1 week', 'Within 2 weeks', 'Within 1 month', 'As soon as possible'], required: true }
  ],
  'Garage Door Repair': [
    { id: 'issue_type', question: 'What is the issue?', type: 'choice', options: ['Door won\'t open/close', 'Broken spring', 'Off track', 'Opener not working', 'Noisy operation', 'Damaged panels', 'Other'], required: true },
    { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['Emergency - Can\'t secure garage', 'Within 24 hours', 'Within 1 week', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Describe the problem', type: 'text', required: true }
  ],
  'Handyman': [
    { id: 'services_needed', question: 'What services do you need?', type: 'multiselect', options: ['Minor Repairs', 'Furniture Assembly', 'TV Mounting', 'Shelf Installation', 'Door Repair', 'Light Fixture', 'Caulking/Sealing', 'Other'], required: true },
    { id: 'project_count', question: 'How many tasks?', type: 'choice', options: ['1-2 small tasks', '3-5 tasks', '6+ tasks or half day', 'Full day of work'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 1 week', 'Within 2 weeks', 'Within 1 month', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'List the tasks you need done', type: 'text', required: true }
  ],
  'Heating & Furnace': [
    { id: 'service_type', question: 'What heating service do you need?', type: 'choice', options: ['Repair', 'New Installation', 'Replacement', 'Maintenance', 'Emergency Service'], required: true },
    { id: 'system_type', question: 'What type of heating system?', type: 'choice', options: ['Gas Furnace', 'Electric Furnace', 'Heat Pump', 'Boiler', 'Radiant Heat', 'Not Sure'], required: true },
    { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['Emergency - No heat', 'Within 24 hours', 'Within 1 week', 'As soon as possible'], required: true },
    { id: 'additional_details', question: 'Describe the issue', type: 'text', required: false }
  ],
  'Pest Control': [
    { id: 'pest_type', question: 'What type of pest?', type: 'multiselect', options: ['Ants', 'Roaches', 'Bed Bugs', 'Termites', 'Rodents', 'Spiders', 'Wasps/Bees', 'Other'], required: true },
    { id: 'property_type', question: 'Property type?', type: 'choice', options: ['Single Family Home', 'Apartment/Condo', 'Commercial', 'Multi-Unit'], required: true },
    { id: 'severity', question: 'How severe is the infestation?', type: 'choice', options: ['Just noticed', 'Moderate - seeing regularly', 'Severe - major infestation'], required: true },
    { id: 'timeline', question: 'When do you need service?', type: 'choice', options: ['Emergency - ASAP', 'Within 24-48 hours', 'Within 1 week', 'Scheduling for prevention'], required: true }
  ],
  'Tile': [
    { id: 'project_type', question: 'What tile work do you need?', type: 'choice', options: ['Floor Tile', 'Wall Tile', 'Backsplash', 'Shower/Tub', 'Countertop', 'Outdoor', 'Repair/Regrout'], required: true },
    { id: 'area_size', question: 'Approximate area?', type: 'choice', options: ['Under 50 sq ft', '50-100 sq ft', '100-200 sq ft', 'Over 200 sq ft'], required: true },
    { id: 'have_tile', question: 'Do you have the tile?', type: 'choice', options: ['Yes, already purchased', 'No, need help selecting', 'Partially - need more'], required: true },
    { id: 'timeline', question: 'When do you need this done?', type: 'choice', options: ['Within 2 weeks', 'Within 1 month', '1-3 months', 'As soon as possible'], required: true }
  ]
};
