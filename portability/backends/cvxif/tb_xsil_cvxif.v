// CV-X-IF MVP bus-functional testbench with protocol assertions.
// Vectors: insn rs1 rs2 rsd expected  (same format as PCPI/CFU).
`timescale 1ns/1ps

module tb_xsil_cvxif;
  reg clk = 0;
  always #5 clk = ~clk;

  reg rst_n = 0;

  reg        issue_valid = 0;
  wire       issue_ready;
  reg [31:0] issue_instr = 0;
  reg  [3:0] issue_id = 0;
  reg        issue_hartid = 0;
  wire       issue_accept;
  wire       issue_writeback;
  wire [2:0] issue_register_read;

  reg        register_valid = 0;
  wire       register_ready;
  reg  [3:0] register_id = 0;
  reg        register_hartid = 0;
  reg [31:0] register_rs1 = 0;
  reg [31:0] register_rs2 = 0;
  reg  [1:0] register_rs_valid = 2'b11;
  reg [31:0] register_rsd = 0;

  reg        commit_valid = 0;
  reg  [3:0] commit_id = 0;
  reg        commit_hartid = 0;
  reg        commit_kill = 0;

  wire       result_valid;
  reg        result_ready = 1;
  wire [3:0] result_id;
  wire       result_hartid;
  wire [31:0] result_data;
  wire [4:0] result_rd;
  wire       result_we;

  xsil_cvxif dut (
    .clk(clk), .rst_n(rst_n),
    .issue_valid(issue_valid), .issue_ready(issue_ready),
    .issue_instr(issue_instr), .issue_id(issue_id), .issue_hartid(issue_hartid),
    .issue_accept(issue_accept), .issue_writeback(issue_writeback),
    .issue_register_read(issue_register_read),
    .register_valid(register_valid), .register_ready(register_ready),
    .register_id(register_id), .register_hartid(register_hartid),
    .register_rs1(register_rs1), .register_rs2(register_rs2),
    .register_rs_valid(register_rs_valid), .register_rsd(register_rsd),
    .commit_valid(commit_valid), .commit_id(commit_id),
    .commit_hartid(commit_hartid), .commit_kill(commit_kill),
    .result_valid(result_valid), .result_ready(result_ready),
    .result_id(result_id), .result_hartid(result_hartid),
    .result_data(result_data), .result_rd(result_rd), .result_we(result_we)
  );

  integer fd, code, n, i;
  integer total, passed, failed;
  integer proto_fail;
  reg [31:0] v_insn, v_rs1, v_rs2, v_rsd, v_exp;
  reg [31:0] got;
  integer cycles;
  integer accepted;
  integer result_seen;
  integer result_before_commit;
  integer committed;

  // Result must not appear before a non-kill commit for that id.
  always @(posedge clk) if (rst_n) begin
    if (result_valid && !committed) begin
      $display("PROTO_FAIL result_before_commit id=%0d at %0t", result_id, $time);
      proto_fail = proto_fail + 1;
      result_before_commit = result_before_commit + 1;
    end
  end

  task automatic drive_idle;
    begin
      issue_valid <= 1'b0;
      register_valid <= 1'b0;
      commit_valid <= 1'b0;
      commit_kill <= 1'b0;
    end
  endtask

  task automatic run_one;
    input [31:0] insn;
    input [31:0] rs1;
    input [31:0] rs2;
    input [31:0] rsd;
    input [31:0] exp;
    begin
      accepted = 0;
      result_seen = 0;
      committed = 0;
      got = 32'hdeadbeef;

      @(posedge clk);
      issue_valid <= 1'b1;
      register_valid <= 1'b1;
      issue_instr <= insn;
      issue_id <= 4'd1;
      issue_hartid <= 1'b0;
      register_id <= 4'd1;
      register_hartid <= 1'b0;
      register_rs1 <= rs1;
      register_rs2 <= rs2;
      register_rs_valid <= 2'b11;
      register_rsd <= rsd;

      // Wait for issue/register accept.
      for (cycles = 0; cycles < 8; cycles = cycles + 1) begin
        @(posedge clk);
        if (issue_ready && register_ready) begin
          if (!issue_accept) begin
            $display("PROTO_FAIL unexpected_reject insn=%h", insn);
            proto_fail = proto_fail + 1;
            failed = failed + 1;
            drive_idle();
            disable run_one;
          end
          if (!issue_writeback) begin
            $display("PROTO_FAIL accept_without_writeback");
            proto_fail = proto_fail + 1;
          end
          accepted = 1;
          break;
        end
      end

      if (!accepted) begin
        $display("PROTO_FAIL issue_timeout insn=%h", insn);
        proto_fail = proto_fail + 1;
        failed = failed + 1;
        drive_idle();
        disable run_one;
      end

      // Drop issue/register; send commit (non-kill) next cycle.
      issue_valid <= 1'b0;
      register_valid <= 1'b0;
      @(posedge clk);
      commit_valid <= 1'b1;
      commit_id <= 4'd1;
      commit_hartid <= 1'b0;
      commit_kill <= 1'b0;
      committed = 1;
      @(posedge clk);
      commit_valid <= 1'b0;

      // Wait for result.
      for (cycles = 0; cycles < 16; cycles = cycles + 1) begin
        @(posedge clk);
        if (result_valid && result_ready) begin
          result_seen = 1;
          got = result_data;
          if (result_id !== 4'd1) begin
            $display("PROTO_FAIL result_id_mismatch got=%0d", result_id);
            proto_fail = proto_fail + 1;
          end
          if (result_we !== 1'b1) begin
            $display("PROTO_FAIL result_without_we");
            proto_fail = proto_fail + 1;
          end
          break;
        end
      end

      if (!result_seen) begin
        $display("PROTO_FAIL result_timeout insn=%h", insn);
        proto_fail = proto_fail + 1;
        failed = failed + 1;
      end else if (got !== exp) begin
        $display("MISMATCH insn=%h rs1=%h rs2=%h rsd=%h expected=%h got=%h",
                 insn, rs1, rs2, rsd, exp, got);
        failed = failed + 1;
      end else begin
        passed = passed + 1;
      end

      drive_idle();
      committed = 0;
      repeat (2) @(posedge clk);
    end
  endtask

  // Unrecognized opcode must be rejected (accept=0).
  task automatic run_reject;
    begin
      @(posedge clk);
      issue_valid <= 1'b1;
      register_valid <= 1'b1;
      issue_instr <= 32'h00000013; // ADDI x0,x0,0 — not our custom match
      issue_id <= 4'd2;
      register_id <= 4'd2;
      register_rs1 <= 0;
      register_rs2 <= 0;
      register_rsd <= 0;
      accepted = 0;
      for (cycles = 0; cycles < 8; cycles = cycles + 1) begin
        @(posedge clk);
        if (issue_ready && register_ready) begin
          accepted = 1;
          if (issue_accept !== 1'b0) begin
            $display("PROTO_FAIL accepted_unrecognized");
            proto_fail = proto_fail + 1;
          end
          break;
        end
      end
      if (!accepted) begin
        $display("PROTO_FAIL reject_timeout");
        proto_fail = proto_fail + 1;
      end
      // Commit rejected insn as non-speculative (spec requires marking).
      issue_valid <= 1'b0;
      register_valid <= 1'b0;
      @(posedge clk);
      commit_valid <= 1'b1;
      commit_id <= 4'd2;
      commit_kill <= 1'b0;
      @(posedge clk);
      commit_valid <= 1'b0;
      // Must not produce a result for rejected insn.
      repeat (4) begin
        @(posedge clk);
        if (result_valid) begin
          $display("PROTO_FAIL result_after_reject");
          proto_fail = proto_fail + 1;
        end
      end
      drive_idle();
    end
  endtask

  initial begin
    total = 0; passed = 0; failed = 0; proto_fail = 0;
    result_before_commit = 0;
    drive_idle();
    repeat (4) @(posedge clk);
    rst_n = 1;
    repeat (2) @(posedge clk);

    fd = $fopen("vectors.hex", "r");
    if (fd == 0) begin
      $display("FATAL: cannot open vectors.hex");
      $finish;
    end

    while (!$feof(fd)) begin
      code = $fscanf(fd, "%h %h %h %h %h\n", v_insn, v_rs1, v_rs2, v_rsd, v_exp);
      if (code == 5) begin
        total = total + 1;
        run_one(v_insn, v_rs1, v_rs2, v_rsd, v_exp);
      end
    end
    $fclose(fd);

    run_reject();

    $display("TB_RESULT total=%0d passed=%0d failed=%0d proto_fail=%0d",
             total, passed, failed, proto_fail);
    if (failed == 0 && proto_fail == 0)
      $display("TB_STATUS DIFFERENTIALLY_VALIDATED");
    else
      $display("TB_STATUS FAILED");
    $finish;
  end
endmodule
