export interface User {
  id: number;
  etsy_user_id: string;
  username: string;
  first_name?: string;
  shop_id?: string;
  shop_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  etsy_order_id: string;
  etsy_shop_id: string;
  buyer_email: string;
  buyer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  filament_assigned: boolean;
  total_filament_used: number;
  internal_notes?: string | null;
  photo_url?: string | null;
  shipping_label_url?: string | null;
  shipping_label_status?: string | null;
  shipping_provider?: string | null;
  tracking_number?: string | null;
  last_customer_contact_at?: string | null;
  production_status: string;
  priority: number;
  print_session_id: number | null;
  estimated_print_time: number | null;
  actual_print_time: number | null;
  print_started_at: string | null;
  print_completed_at: string | null;
  print_failures_count: number;
  print_notes: string | null;
  items: OrderItem[];
  synced_at: string;
}

export interface OrderNote {
  id: number;
  order_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface CommunicationLog {
  id: number;
  order_id: number;
  user_id: number;
  direction: string;
  channel: string;
  message: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  etsy_listing_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Filament {
  id: number;
  user_id: number;
  color: string;
  material: string;
  initial_amount: number;
  current_amount: number;
  unit: string;
  cost_per_gram: number | null;
  used_amount: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilamentUsage {
  id: number;
  filament_id: number;
  order_id: number | null;
  amount_used: number;
  description: string | null;
  created_at: string;
}

export interface ProductProfile {
  id: number;
  user_id: number;
  product_name: string;
  description: string | null;
  standard_filament_amount: number;
  preferred_material: string | null;
  preferred_color: string | null;
  print_time_minutes: number | null;
  notes: string | null;
  category?: string | null;
  nozzle_temp_c?: number | null;
  bed_temp_c?: number | null;
  print_speed_mms?: number | null;
  support_settings?: string | null;
  infill_percent?: number | null;
  layer_height_mm?: number | null;
  material_cost?: number | null;
  labor_minutes?: number | null;
  overhead_cost?: number | null;
  target_margin_pct?: number | null;
  suggested_price?: number | null;
  etsy_listing_id?: string | null;
  etsy_url?: string | null;
  etsy_thumbnail_url?: string | null;
  etsy_price?: number | null;
  etsy_quantity?: number | null;
  etsy_state?: string | null;
  etsy_last_synced_at?: string | null;
  manyfold_model_id?: string | null;
  manyfold_model_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrintSession {
  id: number;
  user_id: number;
  name: string;
  status: string;
  total_estimated_time: number;
  total_actual_time: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  order_count: number;
  orders?: Order[];
  created_at: string;
  updated_at: string;
}