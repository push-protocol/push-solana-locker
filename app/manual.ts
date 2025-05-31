// app/real-complete-flow.ts
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

const PROGRAM_ID = new PublicKey("3zrWaMknHTRQpZSxY4BvQxw9TStSXiHcmcp3NMPTFkke");
const VAULT_SEED = "vault";
const LOCKER_SEED = "locker";
const PRICE_ACCOUNT = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");

// Load keypairs
const adminKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("phantom-keypair.json", "utf8")))
);
const userKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("new-user-keypair.json", "utf8")))
);

// Set up connection and provider
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
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

  console.log("🚀 Testing complete flow - REAL ONLY...\n");

  // Step 1: Test getSolPrice function - NO RETRIES
  console.log("1. Testing getSolPrice function...");
  try {
    const priceData = await program.methods
      .getSolPrice()
      .accounts({
        priceUpdate: PRICE_ACCOUNT,
      })
      .view();

    const usdPrice = priceData.exponent >= 0 
      ? priceData.price * Math.pow(10, priceData.exponent)
      : priceData.price / Math.pow(10, Math.abs(priceData.exponent));
    
    console.log(`✅ SOL Price: ${usdPrice.toFixed(2)} USD`);
    console.log(`⏰ Published: ${new Date(priceData.publishTime * 1000).toISOString()}\n`);
  } catch (error) {
    console.log(`❌ getSolPrice failed: ${error.message}`);
    console.log("❌ PRICE FEED NOT WORKING - STOPPING TEST\n");
    process.exit(1);
  }

  // Step 2: Initialize locker
  console.log("2. Initializing locker...");
  const lockerAccount = await connection.getAccountInfo(lockerPda);
  if (!lockerAccount) {
    const tx = await program.methods
      .initialize()
      .accounts({
        lockerData: lockerPda,
        vault: vaultPda,
        admin: admin,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();
    console.log(`✅ Locker initialized: ${tx}\n`);
  } else {
    console.log("✅ Locker already exists\n");
  }

  // Step 3: Add funds with REAL event listening
  console.log("3. Adding funds with USD calculation and REAL event monitoring...");
  const userBalanceBefore = await connection.getBalance(user);
  const vaultBalanceBefore = await connection.getBalance(vaultPda);
  console.log(`💳 User balance BEFORE: ${userBalanceBefore / LAMPORTS_PER_SOL} SOL`);
  console.log(`🏦 Vault balance BEFORE: ${vaultBalanceBefore / LAMPORTS_PER_SOL} SOL`);

  const amount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
  
  // Check if user has enough SOL, if not, transfer from admin
  if (userBalanceBefore < amount.toNumber()) {
    console.log("💰 User has insufficient funds, transferring from admin...");
    const transferIx = SystemProgram.transfer({
      fromPubkey: admin,
      toPubkey: user,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    });
    const transferTx = new anchor.web3.Transaction().add(transferIx);
    await provider.sendAndConfirm(transferTx, [adminKeypair]);
    
    const newUserBalance = await connection.getBalance(user);
    console.log(`✅ Transferred SOL. User balance now: ${newUserBalance / LAMPORTS_PER_SOL} SOL`);
  }

  const dummyTxHash = new Uint8Array(32).fill(1);

  // Set up REAL event listener - no timeouts, no fallbacks
  console.log("📡 Setting up REAL event listener...");
  const listener = program.addEventListener('fundsAddedEvent', (event: any, slot: number) => {
    console.log("\n📡 REAL FundsAddedEvent received:");
    console.log(`📍 Slot: ${slot}`);
    console.log(`👤 User: ${event.user.toString()}`);
    console.log(`💰 SOL Amount: ${event.solAmount.toString()} lamports (${event.solAmount / LAMPORTS_PER_SOL} SOL)`);
    console.log(`💵 USD Equivalent: $${(event.usdEquivalent / 100).toFixed(2)}`);
    console.log(`📊 SOL Price at time: $${(event.solPriceAtTime / 100).toFixed(2)}`);
  });

  const tx1 = await program.methods
    .addFunds(amount, Array.from(dummyTxHash))
    .accounts({
      locker: lockerPda,
      vault: vaultPda,
      user: user,
      priceUpdate: PRICE_ACCOUNT,
      systemProgram: SystemProgram.programId,
    })
    .signers([userKeypair])
    .rpc();

  console.log(`✅ Funds added: ${tx1}`);

  // Wait for REAL event - fixed time
  console.log("⏳ Waiting 5 seconds for REAL event...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Remove listener
  program.removeEventListener(listener);

  const userBalanceAfter = await connection.getBalance(user);
  const vaultBalanceAfter = await connection.getBalance(vaultPda);
  console.log(`💳 User balance AFTER: ${userBalanceAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`🏦 Vault balance AFTER: ${vaultBalanceAfter / LAMPORTS_PER_SOL} SOL\n`);

  // Step 4: Recover funds
  console.log("4. Testing token recovery...");
  const splitAmounts = [0.02, 0.01];
  for (let i = 0; i < splitAmounts.length; i++) {
    const sol = splitAmounts[i];
    const recoveryAmount = new anchor.BN(sol * LAMPORTS_PER_SOL);

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
    console.log(`🔓 Recovered ${sol} SOL: ${tx}`);
    console.log(`✅ Admin: ${adminAfter / LAMPORTS_PER_SOL} SOL`);
    console.log(`✅ Vault: ${vaultAfter / LAMPORTS_PER_SOL} SOL\n`);
  }
}

run().catch((e) => {
  console.error("❌ REAL Script failed:", e);
  process.exit(1);
});