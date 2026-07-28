// PCPI bus-functional testbench with protocol assertions.
// Driven by a vector file produced by the differential harness.
`timescale 1ns/1ps

module tb_xsil_pcpi;
  reg clk = 0;
  always #5 clk = ~clk;

  reg resetn = 0;
  reg pcpi_valid = 0;
  reg [31:0] pcpi_insn = 0;
  reg [31:0] pcpi_rs1 = 0;
  reg [31:0] pcpi_rs2 = 0;
  reg [31:0] pcpi_rsd = 0;
  wire pcpi_wr;
  wire [31:0] pcpi_rd;
  wire pcpi_wait;
  wire pcpi_ready;

  xsil_pcpi dut (
    .clk(clk), .resetn(resetn),
    .pcpi_valid(pcpi_valid), .pcpi_insn(pcpi_insn),
    .pcpi_rs1(pcpi_rs1), .pcpi_rs2(pcpi_rs2),
    .pcpi_wr(pcpi_wr), .pcpi_rd(pcpi_rd),
    .pcpi_wait(pcpi_wait), .pcpi_ready(pcpi_ready),
    .pcpi_rsd(pcpi_rsd)
  );

  integer fd, code, n, i;
  integer total, passed, failed;
  integer proto_fail;
  reg [31:0] v_insn, v_rs1, v_rs2, v_rsd, v_exp;
  reg [31:0] got;
  integer cycles, ready_seen, wait_seen;
  integer ready_count;

  // ---- Protocol monitors ---------------------------------------------------
  // ready and wr must be coincident; wr without ready is illegal.
  always @(posedge clk) if (resetn) begin
    if (pcpi_wr !== pcpi_ready) begin
      $display("PROTO_FAIL wr_ready_mismatch wr=%0d ready=%0d at time %0t",
               pcpi_wr, pcpi_ready, $time);
      proto_fail = proto_fail + 1;
    end
  end

  // After reset, outputs must be quiet.
  task automatic check_idle_outputs;
    begin
      if (pcpi_ready !== 1'b0 || pcpi_wr !== 1'b0 || pcpi_wait !== 1'b0) begin
        $display("PROTO_FAIL idle_outputs wait=%0d ready=%0d wr=%0d",
                 pcpi_wait, pcpi_ready, pcpi_wr);
        proto_fail = proto_fail + 1;
      end
    end
  endtask

  // Drive one recognized transaction and check the result.
  task automatic run_one;
    input [31:0] insn;
    input [31:0] rs1;
    input [31:0] rs2;
    input [31:0] rsd;
    input [31:0] exp;
    begin
      ready_seen = 0;
      wait_seen = 0;
      ready_count = 0;
      got = 32'hdeadbeef;

      @(posedge clk);
      pcpi_valid <= 1'b1;
      pcpi_insn <= insn;
      pcpi_rs1 <= rs1;
      pcpi_rs2 <= rs2;
      pcpi_rsd <= rsd;

      // Wait asserted within 2 cycles of valid for recognized insn.
      for (cycles = 0; cycles < 16; cycles = cycles + 1) begin
        @(posedge clk);
        if (pcpi_wait) wait_seen = 1;
        if (pcpi_ready) begin
          ready_seen = 1;
          ready_count = ready_count + 1;
          got = pcpi_rd;
          if (pcpi_wr !== 1'b1) begin
            $display("PROTO_FAIL ready_without_wr");
            proto_fail = proto_fail + 1;
          end
        end
        if (ready_seen && !pcpi_ready && ready_count > 0) begin
          // done pulse finished; drop valid next
          break;
        end
      end

      if (!wait_seen) begin
        $display("PROTO_FAIL no_wait_for_recognized");
        proto_fail = proto_fail + 1;
      end
      if (!ready_seen) begin
        $display("PROTO_FAIL no_ready_timeout insn=%h", insn);
        proto_fail = proto_fail + 1;
        failed = failed + 1;
      end else if (got !== exp) begin
        $display("MISMATCH insn=%h rs1=%h rs2=%h rsd=%h expected=%h got=%h",
                 insn, rs1, rs2, rsd, exp, got);
        failed = failed + 1;
      end else begin
        passed = passed + 1;
      end
      if (ready_count > 1) begin
        $display("PROTO_FAIL duplicate_ready count=%0d", ready_count);
        proto_fail = proto_fail + 1;
      end

      pcpi_valid <= 1'b0;
      @(posedge clk);
      // Settle back to idle.
      repeat (2) @(posedge clk);
      check_idle_outputs;
      total = total + 1;
    end
  endtask

  // Unrecognized instruction: must NOT assert wait/ready within 16 cycles.
  task automatic run_unrecognized;
    input [31:0] insn;
    begin
      @(posedge clk);
      pcpi_valid <= 1'b1;
      pcpi_insn <= insn;
      pcpi_rs1 <= 32'h1;
      pcpi_rs2 <= 32'h2;
      pcpi_rsd <= 32'h3;
      for (cycles = 0; cycles < 16; cycles = cycles + 1) begin
        @(posedge clk);
        if (pcpi_wait || pcpi_ready || pcpi_wr) begin
          $display("PROTO_FAIL unrecognized_ack insn=%h wait=%0d ready=%0d wr=%0d",
                   insn, pcpi_wait, pcpi_ready, pcpi_wr);
          proto_fail = proto_fail + 1;
          break;
        end
      end
      pcpi_valid <= 1'b0;
      @(posedge clk);
    end
  endtask

  initial begin
    total = 0; passed = 0; failed = 0; proto_fail = 0;
    resetn = 0;
    repeat (4) @(posedge clk);
    resetn = 1;
    @(posedge clk);
    check_idle_outputs;

    fd = $fopen("vectors.hex", "r");
    if (fd == 0) begin
      $display("FATAL cannot open vectors.hex");
      $finish;
    end

    while (!$feof(fd)) begin
      code = $fscanf(fd, "%h %h %h %h %h\n", v_insn, v_rs1, v_rs2, v_rsd, v_exp);
      if (code == 5) begin
        run_one(v_insn, v_rs1, v_rs2, v_rsd, v_exp);
      end
    end
    $fclose(fd);

    // Protocol: unrecognized encodings must stay silent.
    run_unrecognized(32'h00000013); // ADDI x0,x0,0 — not ours
    run_unrecognized(32'hffffffff);

    $display("TB_RESULT total=%0d passed=%0d failed=%0d proto_fail=%0d",
             total, passed, failed, proto_fail);
    if (failed == 0 && proto_fail == 0 && passed > 0)
      $display("TB_STATUS DIFFERENTIALLY_VALIDATED");
    else
      $display("TB_STATUS FAIL");
    $finish;
  end
endmodule
