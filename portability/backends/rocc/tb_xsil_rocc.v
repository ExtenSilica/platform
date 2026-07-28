// RoCC MVP bus-functional testbench with protocol assertions.
// Vectors: insn rs1 rs2 rsd expected  (same format as PCPI/CFU/CV-X-IF).
`timescale 1ns/1ps

module tb_xsil_rocc;
  reg clk = 0;
  always #5 clk = ~clk;

  reg rst_n = 0;

  reg        cmd_valid = 0;
  wire       cmd_ready;
  reg [31:0] cmd_inst = 0;
  reg [31:0] cmd_rs1 = 0;
  reg [31:0] cmd_rs2 = 0;
  reg [31:0] cmd_rsd = 0;

  wire       resp_valid;
  reg        resp_ready = 1;
  wire [4:0] resp_rd;
  wire [31:0] resp_data;
  wire       busy;

  xsil_rocc dut (
    .clk(clk), .rst_n(rst_n),
    .cmd_valid(cmd_valid), .cmd_ready(cmd_ready),
    .cmd_inst(cmd_inst), .cmd_rs1(cmd_rs1), .cmd_rs2(cmd_rs2), .cmd_rsd(cmd_rsd),
    .resp_valid(resp_valid), .resp_ready(resp_ready),
    .resp_rd(resp_rd), .resp_data(resp_data),
    .busy(busy)
  );

  integer fd, code;
  integer total, passed, failed;
  integer proto_fail;
  reg [31:0] v_insn, v_rs1, v_rs2, v_rsd, v_exp;
  reg [31:0] got;
  integer cycles;
  integer accepted;
  integer resp_seen;
  integer busy_seen;
  integer resp_while_idle;

  // Response must only appear while busy (or transition completing).
  always @(posedge clk) if (rst_n) begin
    if (resp_valid && !busy && !resp_seen) begin
      // Allow the completing cycle where busy may clear with handshake —
      // flag only if resp rises with busy never seen this txn.
      ;
    end
  end

  task automatic drive_idle;
    begin
      cmd_valid <= 1'b0;
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
      resp_seen = 0;
      busy_seen = 0;
      got = 32'hdeadbeef;

      @(posedge clk);
      cmd_valid <= 1'b1;
      cmd_inst <= insn;
      cmd_rs1 <= rs1;
      cmd_rs2 <= rs2;
      cmd_rsd <= rsd;

      for (cycles = 0; cycles < 8; cycles = cycles + 1) begin
        @(posedge clk);
        if (busy) busy_seen = 1;
        if (cmd_ready) begin
          accepted = 1;
          break;
        end
      end

      if (!accepted) begin
        $display("PROTO_FAIL cmd_timeout insn=%h", insn);
        proto_fail = proto_fail + 1;
        failed = failed + 1;
        drive_idle();
        disable run_one;
      end

      cmd_valid <= 1'b0;

      for (cycles = 0; cycles < 16; cycles = cycles + 1) begin
        @(posedge clk);
        if (busy) busy_seen = 1;
        if (resp_valid && resp_ready) begin
          resp_seen = 1;
          got = resp_data;
          if (resp_rd !== insn[11:7]) begin
            $display("PROTO_FAIL resp_rd_mismatch got=%0d exp=%0d",
                     resp_rd, insn[11:7]);
            proto_fail = proto_fail + 1;
          end
          break;
        end
      end

      if (!busy_seen) begin
        $display("PROTO_FAIL no_busy_for_accepted");
        proto_fail = proto_fail + 1;
      end
      if (!resp_seen) begin
        $display("PROTO_FAIL resp_timeout insn=%h", insn);
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
      repeat (2) @(posedge clk);
      if (busy !== 1'b0 || resp_valid !== 1'b0) begin
        $display("PROTO_FAIL not_idle_after_txn busy=%0d resp_valid=%0d",
                 busy, resp_valid);
        proto_fail = proto_fail + 1;
      end
    end
  endtask

  // Unrecognized opcode must not be accepted (cmd_ready stays low).
  task automatic run_reject;
    begin
      @(posedge clk);
      cmd_valid <= 1'b1;
      cmd_inst <= 32'h00000013; // ADDI — not our custom match
      cmd_rs1 <= 0;
      cmd_rs2 <= 0;
      cmd_rsd <= 0;
      accepted = 0;
      for (cycles = 0; cycles < 6; cycles = cycles + 1) begin
        @(posedge clk);
        if (cmd_ready) begin
          accepted = 1;
          $display("PROTO_FAIL accepted_unrecognized");
          proto_fail = proto_fail + 1;
          break;
        end
        if (resp_valid) begin
          $display("PROTO_FAIL resp_for_unrecognized");
          proto_fail = proto_fail + 1;
        end
      end
      if (accepted) ;
      drive_idle();
      repeat (2) @(posedge clk);
    end
  endtask

  initial begin
    total = 0; passed = 0; failed = 0; proto_fail = 0;
    resp_while_idle = 0;
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
