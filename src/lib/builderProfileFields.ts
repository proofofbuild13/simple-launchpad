// Columns of builder_profiles that are readable by all authenticated users.
// `phone` is excluded — it is owner-only and accessed via the
// `get_my_builder_phone` / `set_my_builder_phone` RPCs.
export const BUILDER_PROFILE_PUBLIC_COLUMNS =
  "id,full_name,username,title,domain,location,avatar_url,banner_image,bio,linkedin,github,portfolio,skills,experience_level,hourly_rate,work_preference,open_to_full_time,available,verified,featured_projects,rating,total_projects,completion_rate,response_time_hours,created_at,updated_at";
