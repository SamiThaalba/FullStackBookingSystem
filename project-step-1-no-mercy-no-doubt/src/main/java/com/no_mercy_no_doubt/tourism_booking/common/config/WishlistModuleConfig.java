package com.no_mercy_no_doubt.tourism_booking.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class WishlistModuleConfig {

    /**
     * Used so each alert is evaluated and persisted in its own transaction; one failure does not
     * roll back the whole scheduled poll.
     */
    @Bean(name = "wishlistRequiresNewTransactionTemplate")
    public TransactionTemplate wishlistRequiresNewTransactionTemplate(PlatformTransactionManager txManager) {
        TransactionTemplate template = new TransactionTemplate(txManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }
}
