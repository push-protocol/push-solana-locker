const anchor = require("@coral-xyz/anchor");
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;

describe("pushsolanalocker", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Pushsolanalocker;
  const admin = provider.wallet.publicKey;

  // Derive PDA and bump for "locker"
  const [lockerPda, lockerBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("locker")],
    program.programId
  );
  
  const lockerData = lockerPda; // Used as Account<Locker>
  const lockerUnchecked = lockerPda; // Passed again as UncheckedAccount
  

  it("Initializes locker", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        locker: lockerPda,
        admin: admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Initialized locker:", tx);
  });

  it("Adds funds", async () => {
    const dummyTxHash = Array(32).fill(1);
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const tx = await program.methods
      .addFunds(amount, Buffer.from(dummyTxHash))
      .accounts({
        locker: lockerPda,
        user: admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ AddFunds:", tx);
  });

  it("Recovers funds", async () => {
    const amount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);

    const tx = await program.methods
    .recoverTokens(amount)
    .accounts({
      lockerData: lockerData,
      locker: lockerUnchecked,
      admin: admin,
      recipient: admin,
      systemProgram: SystemProgram.programId,
    })
      .rpc();

    console.log("✅ Recovered funds:", tx);
  });
});
