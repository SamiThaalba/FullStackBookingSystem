package com.no_mercy_no_doubt.tourism_booking.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * If legacy or mis-migrated tables stored {@code name} as {@code bytea}, PostgreSQL rejects
 * {@code lower(text)} on those columns. Normalizes whitelisted columns to {@code varchar} when needed.
 * Skips non-PostgreSQL datasources (e.g. H2 in tests).
 */
@Component
@Order(4)
@RequiredArgsConstructor
@Slf4j
public class PostgresByteaNameColumnRepair implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Value("${spring.datasource.url:}")
    private String dataSourceUrl;

    @Override
    public void run(String... args) {
        if (dataSourceUrl == null || !dataSourceUrl.startsWith("jdbc:postgresql")) {
            return;
        }
        repairIfBytea("cities", "name", 120);
        repairIfBytea("countries", "name", 120);
        repairIfBytea("hotels", "name", 255);
    }

    private void repairIfBytea(String table, String column, int varcharLength) {
        if (!isSafeIdentifier(table) || !isSafeIdentifier(column)) {
            return;
        }
        try {
            List<String> types = jdbcTemplate.query(
                    """
                            select data_type from information_schema.columns
                            where table_schema = current_schema()
                              and table_name = ?
                              and column_name = ?
                            """,
                    (rs, rowNum) -> rs.getString(1),
                    table,
                    column);
            if (types.isEmpty()) {
                return;
            }
            if (!"bytea".equalsIgnoreCase(types.get(0))) {
                return;
            }
            String ddl = "alter table " + table + " alter column " + column
                    + " type varchar(" + varcharLength + ") using convert_from(" + column + ", 'UTF8')";
            log.warn("PostgreSQL column {}.{} is bytea; converting to varchar({}) for text search", table, column,
                    varcharLength);
            jdbcTemplate.execute(ddl);
        } catch (DataAccessException ex) {
            log.warn("Could not repair {}.{} from bytea to varchar: {}", table, column, ex.getMessage());
        }
    }

    private static boolean isSafeIdentifier(String id) {
        return id != null && id.matches("[a-z_][a-z0-9_]*");
    }
}
