import { connectDatabase, disconnectDatabase } from '../config/db';
import { UserModel } from '../models/User';


async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes('--revoke');

  if (!email || !email.includes('@')) {
    console.error('Usage: npm run make-admin -- <email> [--revoke]');
    process.exit(1);
  }

  await connectDatabase();

  const user = await UserModel.findOne({ email });
  if (!user) {
    console.error(`No account found for ${email}. Register through the app first.`);
    await disconnectDatabase();
    process.exit(1);
  }

  const role = revoke ? 'customer' : 'admin';
  if (user.role === role) {
    console.info(`${email} is already ${role} — nothing to do.`);
  } else {
    user.role = role;
    await user.save();
    console.info(`${email} is now ${role}.`);
  }

  const admins = await UserModel.find({ role: 'admin' }).select('email').lean();
  console.info(`Admins (${admins.length}): ${admins.map((a) => a.email).join(', ') || 'none'}`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[make-admin] failed:', (err as Error).message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
