// The value import goes to the file itself (`…/index.js`): Node's ESM
// resolver refuses directory imports, and Next externalises nodemailer, so
// the bare `nodemailer/lib/mail-composer` warned at every start. The types
// live on the bare path in @types/nodemailer; this re-exports them.
declare module "nodemailer/lib/mail-composer/index.js" {
  import MailComposer from "nodemailer/lib/mail-composer";
  export default MailComposer;
}
