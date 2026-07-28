-- CFU bus-functional testbench with protocol assertions.
-- Vector file format (hex): insn rs1 rs2 rsd expected
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;
use ieee.std_logic_textio.all;
use std.env.all;

entity tb_xsil_cfu is
end entity;

architecture sim of tb_xsil_cfu is
  signal clk    : std_ulogic := '0';
  signal rstn   : std_ulogic := '0';
  signal start  : std_ulogic := '0';
  signal inst   : std_ulogic_vector(31 downto 0) := (others => '0');
  signal rs1    : std_ulogic_vector(31 downto 0) := (others => '0');
  signal rs2    : std_ulogic_vector(31 downto 0) := (others => '0');
  signal rsd    : std_ulogic_vector(31 downto 0) := (others => '0');
  signal result : std_ulogic_vector(31 downto 0);
  signal valid  : std_ulogic;
begin
  clk <= not clk after 5 ns;

  dut : entity work.xsil_cfu
    port map (
      clk_i => clk, rstn_i => rstn,
      start_i => start, inst_i => inst,
      rs1_i => rs1, rs2_i => rs2, rsd_i => rsd,
      result_o => result, valid_o => valid
    );

  stimulus : process
    file vecfile : text;
    variable l : line;
    variable good : boolean;
    variable v_insn, v_rs1, v_rs2, v_rsd, v_exp : std_ulogic_vector(31 downto 0);
    variable got : std_ulogic_vector(31 downto 0);
    variable valid_count : integer;
    variable seen_valid : boolean;
    variable total, passed, failed, proto_fail : integer;

    procedure tick is
    begin
      wait until rising_edge(clk);
    end procedure;

    procedure check_idle is
    begin
      if valid /= '0' then
        report "PROTO_FAIL idle_valid" severity warning;
        proto_fail := proto_fail + 1;
      end if;
    end procedure;

    procedure run_one(
      insn_v, rs1_v, rs2_v, rsd_v, exp_v : std_ulogic_vector(31 downto 0)
    ) is
    begin
      seen_valid := false;
      valid_count := 0;
      got := x"deadbeef";

      tick;
      start <= '1';
      inst  <= insn_v;
      rs1   <= rs1_v;
      rs2   <= rs2_v;
      rsd   <= rsd_v;

      tick;
      start <= '0';

      for cyc in 0 to 31 loop
        tick;
        if valid = '1' then
          seen_valid := true;
          valid_count := valid_count + 1;
          got := result;
        end if;
        if seen_valid and valid = '0' then
          exit;
        end if;
      end loop;

      if not seen_valid then
        report "PROTO_FAIL no_valid_timeout" severity warning;
        proto_fail := proto_fail + 1;
        failed := failed + 1;
      elsif got /= exp_v then
        report "MISMATCH insn=" & to_hstring(insn_v) &
               " expected=" & to_hstring(exp_v) &
               " got=" & to_hstring(got) severity warning;
        failed := failed + 1;
      else
        passed := passed + 1;
      end if;

      if valid_count > 1 then
        report "PROTO_FAIL duplicate_valid" severity warning;
        proto_fail := proto_fail + 1;
      end if;

      tick;
      tick;
      check_idle;
      total := total + 1;
    end procedure;

    procedure run_unrecognized(insn_v : std_ulogic_vector(31 downto 0)) is
    begin
      tick;
      start <= '1';
      inst  <= insn_v;
      rs1   <= x"00000001";
      rs2   <= x"00000002";
      rsd   <= x"00000003";
      tick;
      start <= '0';
      for cyc in 0 to 15 loop
        tick;
        if valid = '1' then
          report "PROTO_FAIL unrecognized_ack" severity warning;
          proto_fail := proto_fail + 1;
          exit;
        end if;
      end loop;
    end procedure;

  begin
    total := 0; passed := 0; failed := 0; proto_fail := 0;
    rstn <= '0';
    for i in 1 to 4 loop
      tick;
    end loop;
    rstn <= '1';
    tick;
    check_idle;

    file_open(vecfile, "vectors.hex", read_mode);
    while not endfile(vecfile) loop
      readline(vecfile, l);
      if l'length > 0 then
        hread(l, v_insn, good);
        if good then
          hread(l, v_rs1, good);
          hread(l, v_rs2, good);
          hread(l, v_rsd, good);
          hread(l, v_exp, good);
          if good then
            run_one(v_insn, v_rs1, v_rs2, v_rsd, v_exp);
          end if;
        end if;
      end if;
    end loop;
    file_close(vecfile);

    run_unrecognized(x"00000013");
    run_unrecognized(x"ffffffff");

    report "TB_RESULT total=" & integer'image(total) &
           " passed=" & integer'image(passed) &
           " failed=" & integer'image(failed) &
           " proto_fail=" & integer'image(proto_fail);
    if failed = 0 and proto_fail = 0 and passed > 0 then
      report "TB_STATUS DIFFERENTIALLY_VALIDATED";
    else
      report "TB_STATUS FAIL";
    end if;
    stop(0);
  end process;
end architecture;
