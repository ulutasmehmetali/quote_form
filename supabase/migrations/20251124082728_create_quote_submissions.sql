/*
  # Quote Submission System

  1. New Tables
    - `quote_submissions`
      - `id` (uuid, primary key) - Unique identifier for each quote submission
      - `service_type` (text) - Type of service requested (e.g., Carpentry, Plumbing, etc.)
      - `zip_code` (text) - Customer's postal code
      - `responses` (jsonb) - All customer answers stored as JSON
      - `customer_name` (text, nullable) - Customer's name if provided
      - `customer_email` (text, nullable) - Customer's email if provided
      - `customer_phone` (text, nullable) - Customer's phone if provided
      - `status` (text) - Submission status (pending, contacted, completed)
      - `created_at` (timestamptz) - When the quote was submitted
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `quote_submissions` table
    - Add policy for public insert (anyone can submit a quote)
    - Add policy for authenticated users to view all submissions (for admin dashboard)

  3. Indexes
    - Add index on service_type for faster filtering
    - Add index on status for dashboard queries
    - Add index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS quote_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  zip_code text NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_name text,
  customer_email text,
  customer_phone text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quote_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a quote"
  ON quote_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all quotes"
  ON quote_submissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update quotes"
  ON quote_submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_quote_submissions_service_type ON quote_submissions(service_type);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_status ON quote_submissions(status);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_created_at ON quote_submissions(created_at DESC);