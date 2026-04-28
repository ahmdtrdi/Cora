pub mod initialize_match;

pub use initialize_match::InitializeMatch;

// Anchor #[derive(Accounts)] generates these as pub(crate).
// Must be re-exported so #[program] macro can resolve them at crate root.
pub(crate) use initialize_match::__client_accounts_initialize_match;