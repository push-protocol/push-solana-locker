// app/manual.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import fs from "fs";
import { Program } from "@coral-xyz/anchor";
import type { Pushsolanalocker } from "../target/types/pushsolanalocker";

const PROGRAM_ID = new PublicKey("FVnnKN3tmbSuWcHbc8anrXZnzETHn96FdaKcJxamrfFx");
const VAULT_SEED = "vault";
const LOCKER_SEED = "locker";

// Load keypairs
const adminKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("upgrade-keypair.json", "utf8")))
);
const userKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("clean-user-keypair.json", "utf8")))
);

// Set up connection and provider
const connection = new Connection("https://api.testnet.solana.com", "confirmed");
// const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
  commitment: "confirmed",
});
anchor.setProvider(provider);

// Load IDL
const idl = JSON.parse(fs.readFileSync("target/idl/pushsolanalocker.json", "utf8"));
const program = new Program(idl as Pushsolanalocker, provider);

async function run() {
  const [lockerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(LOCKER_SEED)],
    PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    PROGRAM_ID
  );

  const admin = adminKeypair.publicKey;
  const user = userKeypair.publicKey;

  const lockerAccount = await connection.getAccountInfo(lockerPda);
  if (!lockerAccount) {
    console.log("🔐 Locker not initialized. Initializing...");
    const tx = await program.methods
      .initialize()
      .accounts({
        locker_data: lockerPda,
        vault: vaultPda,
        admin: admin,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();
    console.log("✅ Locker initialized → TX:", tx);
  } else {
    console.log("ℹ️ Locker already exists. Skipping initialization.");
  }

  // ---------------- USER adds funds ----------------
  const userBalanceBefore = await connection.getBalance(user);
  const vaultBalanceBefore = await connection.getBalance(vaultPda);
  console.log(`💳 User balance BEFORE addFunds: ${userBalanceBefore / LAMPORTS_PER_SOL} SOL`);
  console.log(`🏦 Vault balance BEFORE addFunds: ${vaultBalanceBefore / LAMPORTS_PER_SOL} SOL`);

  const amount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
  const dummyTxHash = new Uint8Array(32).fill(1);
  console.log(`Locker: ${lockerPda}`);

  const tx1 = await program.methods
    .addFunds(amount, dummyTxHash)
    .accounts({
      locker: lockerPda,
      vault: vaultPda,
      user: user,
      systemProgram: SystemProgram.programId,
    })
    .signers([userKeypair])
    .rpc();
  console.log("💰 Funds added by user → TX:", tx1);

  const userBalanceAfter = await connection.getBalance(user);
  const vaultBalanceAfter = await connection.getBalance(vaultPda);
  console.log(`💳 User balance AFTER addFunds: ${userBalanceAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`🏦 Vault balance AFTER addFunds: ${vaultBalanceAfter / LAMPORTS_PER_SOL} SOL`);

  // ---------------- ADMIN recovers in multiple txns ----------------
  const splitAmounts = [0.02, 0.01]; // SOL
  for (let i = 0; i < splitAmounts.length; i++) {
    const sol = splitAmounts[i];
    const recoveryAmount = new anchor.BN(sol * LAMPORTS_PER_SOL);
    const adminBefore = await connection.getBalance(admin);
    const vaultBefore = await connection.getBalance(vaultPda);

    const tx = await program.methods
      .recoverTokens(recoveryAmount)
      .accounts({
        lockerData: lockerPda,
        vault: vaultPda,
        recipient: admin,
        admin: admin,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();

    const adminAfter = await connection.getBalance(admin);
    const vaultAfter = await connection.getBalance(vaultPda);
    console.log(`\n🔓 Recovered ${sol} SOL → TX ${i + 1}: ${tx}`);
    console.log(`✅ Admin: ${adminAfter / LAMPORTS_PER_SOL} SOL`);
    console.log(`✅ Vault: ${vaultAfter / LAMPORTS_PER_SOL} SOL`);
  }
}

run().catch((e) => {
  console.error("❌ Script failed:", e);
});
